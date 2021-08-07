import * as fs from "fs-extra";
import * as path from "path";
import * as cp from "child_process";
import * as os from "os";

import ProjectFile from "./ProjectFile";
import Part, { IMetaDependency, MetaDependencyType } from "./Part";
import Templates from "./Templates";
import ProjectIndexFile from "./ProjectIndexFile";

export type ReplacementsMap = Record<string, string | string[]>;

export default class ProjectBuilder
{
    protected additionals: string[] = [];
    protected parts: Part[] = [ ];

    private constructor(
        protected name: string
    ) { }

    public static create(name: string): ProjectBuilder
    {
        return new ProjectBuilder(name);
    }

    public additionalPackages(additionals: string[]): ProjectBuilder
    {
        this.additionals.push(...additionals);

        return this;
    }

    public templateParts(parts: Part[]): ProjectBuilder
    {
        this.parts.push(...parts);
        this.parts.sort((a: Part, b: Part) => b.meta.priority - a.meta.priority);

        return this;
    }

    public foo(): ProjectBuilder
    {
        return this;
    }

    public async build(): Promise<void>
    {
        const globalValues: ReplacementsMap = this.scrapeGlobalValues();

        const files: ProjectFile[] = [
            new ProjectIndexFile(
                path.join("src", "index.ts"),
                (await fs.readFile(Templates.getPathForTemplate("index.ts.template"))).toString(),
                globalValues)
                .processWithParts(this.parts)
        ];

        const commands: string[] = [];

        for(const part of this.parts)
        {
            for(const configFile of Object.keys(part.configData))
                files.push(new ProjectFile(configFile, part.configData[configFile], globalValues));

            commands.push(...part.meta.commands ?? []);
        }

        await fs.mkdirp(this.name); // make project folder
        process.chdir(this.name); // cd into project folder
        await Promise.all(files.map((file: ProjectFile) => file.make())); // make all required files...

        commands.forEach((command: string) =>
        {
            const [exe, ...args] = command.split(" ");
            cp.spawn(exe, args, {
                stdio: [process.stdin, process.stdout, process.stderr],
                env: process.env
            });
        });
    }

    private scrapeGlobalValues(): ReplacementsMap
    {
        return this.parts.reduce((acc: ReplacementsMap, current: Part) => {
            const additionalKeys: string[] = Object.keys(current.meta.cross_template_replacements ?? {});

            for(const key of additionalKeys)
            {
                if(!(key in acc) || !Array.isArray(acc[key]))
                    acc[key] = current.meta.cross_template_replacements[key];
                else
                    (acc[key] as string[]).push(...current.meta.cross_template_replacements[key]);
            }

            return acc;
        }, {
            "project_name": this.name,
            "whoami": os.userInfo().username,
            project_dependencies: [
                ...this.parts
                    .filter((part: Part) => part.meta.no_install !== true && part.meta.dev !== true)
                    .map((part: Part) => ProjectBuilder.formatDependency(part.meta.name, part.meta.version)),
                ...this.parts
                    .map((part: Part) => part.meta.dependencies).flat()
                    .filter((dep: IMetaDependency) => dep.type === MetaDependencyType.External && dep.dev !== true)
                    .map((dep: IMetaDependency) => ProjectBuilder.formatDependency(dep.package, dep.version))
            ],
            project_dev_dependencies: [
                ...this.parts
                    .filter((part: Part) => part.meta.no_install !== true && part.meta.dev === true)
                    .map((part: Part) => ProjectBuilder.formatDependency(part.meta.name, part.meta.version)),
                ...this.parts
                    .map((part: Part) => part.meta.dependencies).flat()
                    .filter((dep: IMetaDependency) => dep.type === MetaDependencyType.External && dep.dev === true)
                    .map((dep: IMetaDependency) => ProjectBuilder.formatDependency(dep.package, dep.version))
            ],
            logger_info: "console.log",
            logger_error: "console.error"
        });
    }

    public static formatDependency(packageName: string, version: string): string
    {
        return `"${packageName}": "${version}"`;
    }
}
