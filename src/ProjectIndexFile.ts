
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
        this.replacements["index_imports"] = [
            ...this.parts.map((part: Part) => (part.meta.dependencies ?? [])
                .filter((dep: IMetaDependency) => dep.noinclude !== true)
                .sort((depA: IMetaDependency, depB: IMetaDependency) => depB.package.localeCompare(depA.package))
                .map((dep: IMetaDependency) => `import * as ${dep.as} from "${dep.package}";`)).flat(),
            "",
            ...this.parts.map((part: Part) => part.meta.additional_imports ?? []).flat(),
            "",
            "[[_index_imports_]]"
        ];
        this.content = this.processReplacements(this.content);

        for(const part of this.parts)
        {
            this.replacements["index_content"] = part.partData ?? "{{index_content}}";
            this.replacements["index_imports"] = [ "[[_index_imports_]]" ];

            this.content = this.processReplacements(this.content);
        }

        this.replacements["index_content"] = "";
        this.replacements["index_imports"] = [];

        await super.make(); // Cleanup and write file
    }
}
