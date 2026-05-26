CREATE TABLE "commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source_user_id" integer NOT NULL,
	"bv_matched" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"min_price" numeric(12, 2),
	"max_price" numeric(12, 2),
	"bv_amount" numeric(12, 2) DEFAULT '3000' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"amount" numeric(12, 2),
	"related_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wash_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"executed_by" integer NOT NULL,
	"wallets_reset" integer DEFAULT 0 NOT NULL,
	"total_amount_wiped" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"mobile_number" text,
	"address" text,
	"country_code" text DEFAULT 'US',
	"status" text DEFAULT 'pending' NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'distributor' NOT NULL,
	"referral_code" text NOT NULL,
	"referrer_id" text,
	"sponsor_id" integer,
	"package_type" text,
	"username" text,
	"state" text,
	"city" text,
	"dob" text,
	"gender" text,
	"profile_photo" text,
	"govt_id_proof" text,
	"sponsor_referral_id" text,
	"placement_side" text,
	"usdt_address" text,
	"bank_details" text,
	"left_bv" numeric(12, 2) DEFAULT '0' NOT NULL,
	"right_bv" numeric(12, 2) DEFAULT '0' NOT NULL,
	"residual_left_bv" numeric(12, 2) DEFAULT '0' NOT NULL,
	"residual_right_bv" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "network_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"parent_id" integer,
	"sponsor_id" integer,
	"leg" text,
	"left_child_id" integer,
	"right_child_id" integer,
	"depth" integer DEFAULT 0 NOT NULL,
	"left_bv" numeric(12, 2) DEFAULT '0' NOT NULL,
	"right_bv" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_nodes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer,
	"code" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"coupon_type" text DEFAULT 'general' NOT NULL,
	"generated_by" text DEFAULT 'system' NOT NULL,
	"expiry_date" timestamp with time zone,
	"redeemed_by" integer,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crypto_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"network" text NOT NULL,
	"from_address" text,
	"to_address" text NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USDT' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"webhook_source" text,
	"raw_payload" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_transactions_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "manual_deposit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount_in_usdt" numeric(18, 6) NOT NULL,
	"blockchain_network" text NOT NULL,
	"sender_wallet_address" text NOT NULL,
	"tx_hash" text,
	"screenshot_url" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"coupon1_code" text,
	"coupon2_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sender_wallet_address" text,
	"transferred_amount" numeric(12, 2),
	"blockchain_network" text,
	"payment_screenshot_url" text,
	"payment_date_time" timestamp with time zone,
	"payment_reference_number" text,
	"collector_name" text,
	"collector_id" text,
	"payment_date" timestamp with time zone,
	"remarks" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_earned" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"available_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
