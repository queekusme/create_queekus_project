import * as fs from "fs-extra";
import * as path from "path";

import { Command, OptionValues } from "commander";

import Templates from "./Templates";
import ProjectBuilder from "./ProjectBuilder";

const program = new Command();

(async() => {
    program
        .version(JSON.parse((await fs.readFile(path.join(process.cwd(), "package.json"))).toString()).version, "-v, --version", "output the current version")
        .argument("<project_name>", "name of the project")
        //.argument('[additional...]', 'additional packages to install, dev packages are prefixed with D_ e.g. D_packagename')
        .action(async (project_name: string/* , additional: string[] */, options: OptionValues) =>
        {
            // Collect Options
            const optionsToLoad: string[] = Object.keys(options)
                .map((opt: string) => options[opt] as boolean ? opt : undefined)
                .filter((val: string) => val !== undefined) as string[];

            await ProjectBuilder
                .create(project_name)
                //.additionalPackages(additional)
                .templateParts([
                    ...(await Templates.getParts(Templates.required_Templates)),
                    ...(await Templates.getParts(optionsToLoad))
                ])
                .build();
        });

    for(const key of Templates.optional_Templates)
    {
        program.option(`--${key}`, `install ${key} into project`);
    }

    program.parse(process.argv);
})();
