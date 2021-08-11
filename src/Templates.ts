import * as path from "path";
import * as fs from "fs-extra";

import Part from "./Part";

export default class Templates
{
    public static readonly required_Templates: string[] = [
        "node",
        "typescript",
        "eslint",
        "git",
        "license",
        "winston"
    ];
    public static readonly templates_omit_from_optional: string[] = [
        "index.ts.template",
        ".DS_Store"
    ];

    public static readonly optional_Templates: string[]
        = fs.readdirSync(path.join(__dirname, "..", "templates"))
            .filter((folder: string) => Templates.required_Templates.indexOf(folder) === -1)
            .filter((folder: string) => Templates.templates_omit_from_optional.indexOf(folder) === -1);

    public static getPathForTemplate(template: string): string
    {
        return path.join(__dirname, "..", "templates", template);
    }

    public static getParts(templates: string[]): Promise<Part[]>
    {
        return Part.load(...(templates.map(Templates.getPathForTemplate)));
    }
}
