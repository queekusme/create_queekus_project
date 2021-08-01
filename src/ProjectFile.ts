import * as fs from "fs-extra";
import * as path from "path";

export default class ProjectFile
{
    constructor(
        protected relativePath: string,
        protected content: string,
        protected replacements: Record<string, string | string[]>
    ) {}

    public async make(): Promise<void>
    {
        this.content = this.processReplacements(this.content);

        await fs.mkdirp(path.dirname(this.relativePath)); // Make folder for file to go in

        await this.performIndentResolutionPass();

        await fs.writeFile(this.relativePath, this.content, {flag: "w"});

    }

    protected processReplacements(raw: string): string
    {
        let valueReplacedContent: string = raw;

        for (const key of Object.keys(this.replacements)) {
            if (Array.isArray(this.replacements[key]))
            {
                valueReplacedContent = valueReplacedContent.replace(new RegExp(`\\[\\[${key}\\]\\]\n?`, "g"), (this.replacements[key] as string[]).join(",\n"));
                valueReplacedContent = valueReplacedContent.replace(new RegExp(`\\[\\[_${key}_\\]\\]\n?`, "g"), (this.replacements[key] as string[]).join("\n"));
            }
            else
                valueReplacedContent = valueReplacedContent.replace(new RegExp(`\\{\\{${key}\\}\\}\n?`, "g"), this.replacements[key] as string);
        }

        return valueReplacedContent;
    }

    public async performIndentResolutionPass(): Promise<void>
    {
        const indentIdentifier: RegExp = /__indent_(-?\d+)__/g;
        const fileContents: string[] = this.content.split("\n");
        const indentStack: number[] = [];

        for(let i: number = 0; i < fileContents.length; i++)
        {
            const indentTagMatches: RegExpExecArray | null = indentIdentifier.exec(fileContents[i]);

            if(indentTagMatches !== null)
                indentStack.push(parseInt(indentTagMatches[1]));

            fileContents[i] = "    ".repeat(indentStack.reduce((a: number, b: number) => a + b, 0)) + fileContents[i];
        }

        this.content = fileContents.filter((line: string) => !line.match(indentIdentifier)).join("\n");
    }
}
