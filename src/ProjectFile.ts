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
}
