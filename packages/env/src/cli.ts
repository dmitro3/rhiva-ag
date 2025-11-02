#!/usr/bin/env bun
import { Command } from "commander";
import { writeEnvTypes } from ".";

const program = new Command();
program
  .name("write-env-types")
  .description("Generate environment variable type definitions")
  .option(
    "-o, --out <path>",
    "Output file path for generated env types",
    "src/env.ts",
  )
  .option("-i, --in <path>", "Output file path for generated env types", ".env")
  .action(async (options) => {
    writeEnvTypes(options);
  });

program.parse(process.argv);
