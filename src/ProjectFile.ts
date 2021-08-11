import * as fs from "fs-extra";
import * as path from "path";
import { ReplacementsMap } from "ProjectBuilder";

interface Replacement
{
    match: (key: string) => RegExp;
    join?: string;
}

function makeReplacement(prefix: string, suffix: string, additional: string, join?: string): Replacement
{
    const escapedPrefix: string = `\\${prefix}\\${prefix}`;
    const escapedSuffix: string = `\\${suffix}\\${suffix}`;
    const escapedAdditional: string = additional !== "" ? `\\${additional}` : "";

    return { match: (key: string) => new RegExp(`${escapedPrefix}${escapedAdditional}${key}${escapedAdditional}${escapedSuffix}\n?`, "g"), join };
}

type ShortReplacementCreator = (additional: string, join?: string) => Replacement;

const makeArrayReplacement: ShortReplacementCreator = makeReplacement.bind(undefined, "[", "]");
const makeObjectReplacement: ShortReplacementCreator = makeReplacement.bind(undefined, "{", "}");

export default class ProjectFile
{
    private readonly replacementData: Replacement[] = [
        makeArrayReplacement("", ",\n"),
        makeArrayReplacement("_", "\n"),
        makeArrayReplacement("|", " || "),
        makeArrayReplacement("&", " && "),
        makeArrayReplacement("?", " ?? "),
        makeObjectReplacement("")
    ];

    constructor(
        protected relativePath: string,
        protected content: string,
        protected replacements: ReplacementsMap
    ) { }

    public async make(): Promise<void>
    {
        await fs.mkdirp(path.dirname(this.relativePath)); // Make folder for file to go in

        this.content = this.processReplacements(this.content);

        this.cleanUnusedReplacements();
        this.performIndentResolutionPass();

        await fs.writeFile(this.relativePath, this.content, {flag: "w"});
    }

    protected processReplacements(raw: string): string
    {
        let valueReplacedContent: string = raw;

        for (const key of Object.keys(this.replacements))
        {
            this.replacementData.forEach((replacement: Replacement) => valueReplacedContent = this.doReplace(replacement, valueReplacedContent, key, this.replacements[key]));
        }

        return valueReplacedContent;
    }

    protected doReplace(replacement: Replacement, original: string, key: string, withReplacement: string | string[]): string
    {
        return original.replace(replacement.match(key), Array.isArray(withReplacement) ? withReplacement.join(replacement.join) : withReplacement)
    }

    protected cleanUnusedReplacements(): void
    {
        let valueReplacedContent: string = this.content;

        this.replacementData.forEach((replacement: Replacement) => {
            valueReplacedContent = this.doReplace(replacement, valueReplacedContent, "[^\\]\\}]+", "");
        });

        this.content = valueReplacedContent;
    }

    public performIndentResolutionPass(): void
    {
        const indentIdentifier: RegExp = /__indent_(-?\d+)__/g;
        const fileContents: string[] = this.content.split("\n");
        const indentStack: number[] = [];

        for(let i: number = 0; i < fileContents.length; i++)
        {
            const indentTagMatches: RegExpExecArray | null = indentIdentifier.exec(fileContents[i]);

            if(indentTagMatches !== null)
                indentStack.push(parseInt(indentTagMatches[1]));

            if(fileContents[i].trim().length === 0)
                fileContents[i] = fileContents[i].trim(); // Trim tabs on empty lines

            if(fileContents[i].length > 0)
                fileContents[i] = "    ".repeat(indentStack.reduce((a: number, b: number) => a + b, 0)) + fileContents[i];
        }

        if(fileContents[fileContents.length -1].length > 0)
            fileContents.push(""); // End of file newline enforcement

        this.content = fileContents.filter((line: string) => !line.match(indentIdentifier)).join("\n");
    }
}
