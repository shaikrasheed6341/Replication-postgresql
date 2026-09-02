CREATE TABLE "blog" (
	"id" integer PRIMARY KEY NOT NULL,
	"tittle" varchar,
	"desc" varchar,
	"counts" integer
);
--> statement-breakpoint
CREATE TABLE "comes" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar,
	"comesL" varchar
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar,
	"email" varchar,
	"password" varchar,
	"createdat" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visted" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar
);
