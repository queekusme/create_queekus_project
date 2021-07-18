
import ProjectFile from "./ProjectFile";
import Part, { IMetaDependency } from "./Part";

export default class ProjectIndexFile extends ProjectFile
{
    protected parts: Part[] = [];

    public processWithParts(parts: Part[]): ProjectIndexFile
    {
        this.parts = parts;

        return this;
    }

    public async make(): Promise<void>
    {
        this.content = this.processReplacements(this.content);

        this.replacements["index_imports"] = [
            ...this.parts.map((part: Part) => (part.meta.additional_imports ?? [])).flat(),
            "[[_index_imports_]]"
        ];
        this.content = this.processReplacements(this.content);
        delete this.replacements["index_imports"];

        for(const part of this.parts)
        {
            this.replacements["index_imports"] = [
                ...part.meta.dependencies
                    .filter((dep: IMetaDependency) => dep.noinclude !== true)
                    .map((dep: IMetaDependency) => `import * as ${dep.as} from "${dep.package}";`),
                "[[_index_imports_]]"
            ];
        }

        for(const part of this.parts.map((part: Part) => part.partData ?? []).flat())
        {
            this.replacements["index_content"] = part;

            this.content = this.processReplacements(this.content);
        }

        this.replacements["index_content"] = "";
        this.replacements["index_imports"] = [];
        await super.make(); // Cleanup and write file
    }
}
