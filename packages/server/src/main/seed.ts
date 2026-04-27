/**
 * Demo data seeder.
 *
 * Pending refactor: previously instantiated repositories and services
 * directly with the better-sqlite3 client. Sessions are now owned by the
 * TypeORM-backed SessionModule, so the seeder needs to bootstrap a Nest
 * application context to obtain TaskLifecycleService et al. Stubbed out
 * for now to keep the build green; reinstate the seed flows once the
 * Nest bootstrap helper lands.
 */
process.stdout.write(
    "Seed script temporarily disabled while session module migrates to TypeORM.\n",
);
process.exitCode = 0;
