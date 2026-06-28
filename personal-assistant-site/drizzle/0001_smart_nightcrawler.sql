CREATE TABLE `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`request_text` text NOT NULL,
	`intent` text DEFAULT 'question' NOT NULL,
	`route` text DEFAULT 'unconfigured' NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`response_text` text DEFAULT '' NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
