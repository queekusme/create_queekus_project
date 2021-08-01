import * as fs from "fs-extra";
import * as path from "path";
import * as YAML from "yaml";

interface IMetaRequired
{
    name: string;
    dev: boolean;
    no_install: boolean;
    no_default_include: boolean;
    priority: number;
    version: string;
    part_files: string[];
    additional_files: string[];
    additional_imports: string[];
    commands: string[];
}

interface IUnparsedMeta extends IMetaRequired
{
    dependencies: string[];
}

export enum MetaDependencyType
{
    External = "external",
    Builtin = "builtin"
}

export interface IMetaDependency
{
    type: MetaDependencyType;
    dev: boolean
    package: string;
    version: string;
    as: string | undefined;
    noinclude: boolean;
}

export interface IMeta extends IMetaRequired
{
    dependencies: IMetaDependency[];
}

export default class Part
{
    constructor(
        public readonly meta: Readonly<IMeta>,
        public readonly partData: string | undefined,
        public readonly configData: Record<string, string>
    ) {}

    public static async load(...paths: string[]): Promise<Part[]>
    {
        return await Promise.all(paths.map(Part.from));
    }

    public static async from(metaPath: string): Promise<Part>
    {
        const resolvedPath: string = path.resolve(metaPath);

        if (!(await fs.stat(resolvedPath)).isDirectory())
            throw new Error(`${resolvedPath} is not a valid directory...`);


        const meta: IMeta = await Part.collectMetadata(resolvedPath);
        const parts: string | undefined = (meta.part_files ?? []).length > 0
            ? (await Promise.all((meta.part_files).map(Part.collectFile.bind(Part, resolvedPath) as (file: string) => Promise<string>))).join("\n")
            : undefined;
        const config: Record<string, string> = {};

        for(const file of (meta.additional_files ?? []))
        {
            const matches: string[] = file.split(" as ");

            if(matches.length > 1)
            {
                config[matches[1].trim()] = await Part.collectFile(resolvedPath, matches[0].trim());

                continue;
            }

            config[file.replace(".template", "")] = await Part.collectFile(resolvedPath, file);
        }

        return new Part(meta, parts, config);
    }

    private static async collectMetadata(resolvedPath: string): Promise<IMeta>
    {
        const resolvedMetaFile: string = path.join(resolvedPath, ".meta.yml");

        if (!(await fs.stat(resolvedMetaFile)).isFile())
            throw new Error(`${resolvedMetaFile} is not a valid file...`);

        let metaUnparsed: IUnparsedMeta;

        try
        {
            metaUnparsed = YAML.parse((await fs.readFile(resolvedMetaFile)).toString());
        }
        catch(e)
        {
            throw new Error(`${resolvedMetaFile} cannot be parsed... ${e.message}`);
        }

        return Object.assign({}, metaUnparsed, {
            dependencies: (metaUnparsed.dependencies ?? []).map((dependency: string): IMetaDependency => {
                const sections: string[] = dependency.split(" ");

                const dep: Partial<IMetaDependency> = {};

                for(let i: number = 0; i < sections.length; i++)
                {
                    switch(i)
                    {
                        case 0:
                            dep.type = sections[i] as MetaDependencyType;
                            break;
                        case 1:
                            dep.dev = sections[i] === "dev";
                            break;
                        case 2:
                        {
                            const match: RegExpMatchArray | null = sections[i].match(/([^\[]+)(?:\[([^\]]+)\])?/);

                            if(match === null)
                                throw new Error(`Cannot parse Dependency ${dependency} in ${resolvedMetaFile}`);

                            dep.package = match[1];
                            dep.as = match[2] ?? match[1];
                            break;
                        }
                        case 3:
                            dep.version = sections[i];
                            break;
                        case 4:
                            dep.noinclude = sections[i] === "noinclude";
                            break;
                    }
                }

                return dep as IMetaDependency;
            })
        });
    }

    private static async collectFile(resolvedPath: string, file: string): Promise<string>
    {
        const resolvedPartFile: string = path.join(resolvedPath, file);

        if (!(await fs.stat(resolvedPartFile)).isFile())
            throw new Error(`${resolvedPartFile} is not a valid file...`);

        let part: string;

        try
        {
            part = (await fs.readFile(resolvedPartFile)).toString();
        }
        catch(e)
        {
            throw new Error(`${resolvedPartFile} cannot be parsed... ${e.message}`);
        }

        return part;
    }
}
