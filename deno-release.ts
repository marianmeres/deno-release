#!/usr/bin/env -S deno run -A

/**
 * @module
 * Opinionated CLI tool for releasing Deno projects.
 *
 * Bumps the version in `deno.json`, creates an annotated git tag,
 * and pushes everything to the remote repository.
 *
 * @example
 * ```bash
 * deno run -A jsr:@marianmeres/deno-release              # defaults to patch
 * deno run -A jsr:@marianmeres/deno-release patch
 * deno run -A jsr:@marianmeres/deno-release minor "Added new feature"
 * deno run -A jsr:@marianmeres/deno-release --yes patch  # skip confirmation prompts
 * ```
 */

/** Semantic version bump type */
export type VersionType = "major" | "minor" | "patch";

const VALID_VERSION_TYPES: VersionType[] = ["major", "minor", "patch"];

// Colors for terminal output
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;
const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;

/** Result of running a shell command */
interface CommandResult {
	code: number;
	stdout: string;
	stderr: string;
}

/**
 * Executes a shell command and returns the result.
 * @param cmd - Array of command and arguments
 * @returns Promise resolving to command result with exit code, stdout, and stderr
 */
async function run(cmd: string[]): Promise<CommandResult> {
	const command = new Deno.Command(cmd[0], {
		args: cmd.slice(1),
		stdout: "piped",
		stderr: "piped",
	});
	const { code, stdout, stderr } = await command.output();
	return {
		code,
		stdout: new TextDecoder().decode(stdout).trim(),
		stderr: new TextDecoder().decode(stderr).trim(),
	};
}

/**
 * Executes a shell command and exits the process if it fails.
 * @param cmd - Array of command and arguments
 * @returns Promise resolving to stdout on success
 */
async function runOrExit(cmd: string[]): Promise<string> {
	const { code, stdout, stderr } = await run(cmd);
	if (code !== 0) {
		console.error(red(`Error running: ${cmd.join(" ")}`));
		if (stderr) console.error(stderr);
		Deno.exit(1);
	}
	return stdout;
}

/**
 * Checks if a file or directory exists at the given path.
 * @param path - Path to check
 * @param isDirectory - If true, checks for directory; otherwise checks for file
 * @returns Promise resolving to true if path exists and matches the type
 */
async function exists(path: string, isDirectory = false): Promise<boolean> {
	try {
		const stat = await Deno.stat(path);
		return isDirectory ? stat.isDirectory : stat.isFile;
	} catch {
		return false;
	}
}

/**
 * Parses a semver version string into its components.
 * @param version - Version string in format "major.minor.patch"
 * @returns Tuple of [major, minor, patch] numbers
 */
function parseVersion(version: string): [number, number, number] {
	const parts = version.split(".").map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) {
		console.error(red(`Error: Invalid version format: ${version}`));
		Deno.exit(1);
	}
	return parts as [number, number, number];
}

/**
 * Bumps a semantic version based on the specified type.
 * @param current - Current version string (e.g., "1.2.3")
 * @param type - Type of version bump: "major", "minor", or "patch"
 * @returns New version string after the bump
 *
 * @example
 * ```ts
 * bumpVersion("1.2.3", "patch"); // "1.2.4"
 * bumpVersion("1.2.3", "minor"); // "1.3.0"
 * bumpVersion("1.2.3", "major"); // "2.0.0"
 * ```
 */
export function bumpVersion(current: string, type: VersionType): string {
	let [major, minor, patch] = parseVersion(current);
	switch (type) {
		case "major":
			major++;
			minor = 0;
			patch = 0;
			break;
		case "minor":
			minor++;
			patch = 0;
			break;
		case "patch":
			patch++;
			break;
	}
	return `${major}.${minor}.${patch}`;
}

/**
 * Main entry point for the release CLI.
 *
 * Performs the following steps:
 * 1. Validates git repository and deno.json existence
 * 2. Checks for uncommitted changes
 * 3. Warns if not on main/master branch
 * 4. Shows preview and asks for confirmation
 * 5. Updates version in deno.json
 * 6. Creates commit and annotated tag
 * 7. Pushes to remote repository
 *
 * @returns Promise that resolves when release is complete
 */
async function main(): Promise<void> {
	// Parse --yes/-y flag (can appear anywhere in args)
	const args = Deno.args.filter((arg) => arg !== "--yes" && arg !== "-y");
	const skipPrompts = Deno.args.length !== args.length;

	const [firstArg, ...messageParts] = args;

	// Determine version type and custom message
	// If first arg is a valid version type, use it; otherwise default to "patch"
	// and treat all args as the message
	let versionType: VersionType;
	let customMessage: string;

	if (firstArg && VALID_VERSION_TYPES.includes(firstArg as VersionType)) {
		versionType = firstArg as VersionType;
		customMessage = messageParts.join(" ");
	} else {
		versionType = "patch";
		customMessage = firstArg ? [firstArg, ...messageParts].join(" ") : "";
	}

	// Check if we're in a git repository
	if (!(await exists(".git", true))) {
		console.error(red("Error: Not in a git repository"));
		Deno.exit(1);
	}

	// Check if deno.json exists
	if (!(await exists("deno.json"))) {
		console.error(red("Error: deno.json not found"));
		Deno.exit(1);
	}

	// Check if everything is committed
	const { stdout: status } = await run(["git", "status", "--porcelain"]);
	if (status) {
		console.error(
			red("Error: You have uncommitted changes. Please commit all changes before releasing.")
		);
		const { stdout: shortStatus } = await run(["git", "status", "--short"]);
		console.log(shortStatus);
		Deno.exit(1);
	}

	// Check if we're on the main/master branch
	const currentBranch = await runOrExit(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
	if (currentBranch !== "main" && currentBranch !== "master") {
		console.log(yellow(`Warning: You're not on main/master branch (current: ${currentBranch})`));
		if (!skipPrompts) {
			const answer = prompt("Continue anyway? (y/N):");
			if (answer?.toLowerCase() !== "y") {
				Deno.exit(1);
			}
		}
	}

	// Get current version from deno.json
	const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
	const currentVersion = denoJson.version;
	if (!currentVersion) {
		console.error(red("Error: No version field found in deno.json"));
		Deno.exit(1);
	}
	console.log(`Current version: ${currentVersion}`);

	// Calculate new version
	const newVersion = bumpVersion(currentVersion, versionType as VersionType);

	// Show what will happen and ask for confirmation
	console.log();
	console.log("This will:");
	console.log(`  - Bump ${bold(versionType)} version to ${green(newVersion)}`);
	if (customMessage) {
		console.log(`  - Create a git tag with message: 'Release: ${newVersion} (${customMessage})'`);
	} else {
		console.log(`  - Create a git tag with message: 'Release: ${newVersion}'`);
	}
	console.log("  - Push to remote repository");
	console.log();

	if (!skipPrompts) {
		const confirm = prompt("Continue? (y/N):");
		if (confirm?.toLowerCase() !== "y") {
			console.log("Release cancelled.");
			Deno.exit(0);
		}
	}

	// Update version in deno.json
	console.log(`Bumping ${versionType} version...`);
	denoJson.version = newVersion;
	await Deno.writeTextFile("deno.json", JSON.stringify(denoJson, null, 2) + "\n");

	// Commit the version change
	const commitMessage = customMessage
		? `Release: ${newVersion} (${customMessage})`
		: `Release: ${newVersion}`;

	await runOrExit(["git", "add", "deno.json"]);
	await runOrExit(["git", "commit", "-m", commitMessage]);
	await runOrExit(["git", "tag", "-a", `v${newVersion}`, "-m", commitMessage]);

	console.log(`Version bumped to: ${green(`v${newVersion}`)}`);

	// Push everything including tags
	console.log("Pushing to remote...");
	await runOrExit(["git", "push"]);
	await runOrExit(["git", "push", "--tags"]);

	console.log(green(`Release complete! New version: v${newVersion}`));
}

main();
