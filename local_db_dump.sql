--
-- PostgreSQL database dump
--

\restrict weairJbDCYj2uWTGjZyrLCzNOfXJxqXlbS7n6N9fHEoHqnRVpOcpxmdPvYr1vde

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.wash_events DROP CONSTRAINT wash_events_pkey;
ALTER TABLE ONLY public.wallets DROP CONSTRAINT wallets_user_id_unique;
ALTER TABLE ONLY public.wallets DROP CONSTRAINT wallets_pkey;
ALTER TABLE ONLY public.wallet_transactions DROP CONSTRAINT wallet_transactions_pkey;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_referral_code_unique;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_unique;
ALTER TABLE ONLY public.user_sessions DROP CONSTRAINT user_sessions_pkey;
ALTER TABLE ONLY public.payment_submissions DROP CONSTRAINT payment_submissions_pkey;
ALTER TABLE ONLY public.otp_verifications DROP CONSTRAINT otp_verifications_pkey;
ALTER TABLE ONLY public.network_nodes DROP CONSTRAINT network_nodes_user_id_unique;
ALTER TABLE ONLY public.network_nodes DROP CONSTRAINT network_nodes_pkey;
ALTER TABLE ONLY public.fraud_logs DROP CONSTRAINT fraud_logs_pkey;
ALTER TABLE ONLY public.financial_ledger DROP CONSTRAINT financial_ledger_pkey;
ALTER TABLE ONLY public.crypto_transactions DROP CONSTRAINT crypto_transactions_tx_hash_unique;
ALTER TABLE ONLY public.crypto_transactions DROP CONSTRAINT crypto_transactions_pkey;
ALTER TABLE ONLY public.courses DROP CONSTRAINT courses_pkey;
ALTER TABLE ONLY public.coupons DROP CONSTRAINT coupons_pkey;
ALTER TABLE ONLY public.coupons DROP CONSTRAINT coupons_code_unique;
ALTER TABLE ONLY public.commissions DROP CONSTRAINT commissions_pkey;
ALTER TABLE ONLY public.activity_feed DROP CONSTRAINT activity_feed_pkey;
ALTER TABLE public.wash_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.wallets ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.wallet_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.user_sessions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.payment_submissions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.otp_verifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.network_nodes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.fraud_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.financial_ledger ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.crypto_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.courses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.coupons ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.commissions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.activity_feed ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE public.wash_events_id_seq;
DROP TABLE public.wash_events;
DROP SEQUENCE public.wallets_id_seq;
DROP TABLE public.wallets;
DROP SEQUENCE public.wallet_transactions_id_seq;
DROP TABLE public.wallet_transactions;
DROP SEQUENCE public.users_id_seq;
DROP TABLE public.users;
DROP SEQUENCE public.user_sessions_id_seq;
DROP TABLE public.user_sessions;
DROP SEQUENCE public.payment_submissions_id_seq;
DROP TABLE public.payment_submissions;
DROP SEQUENCE public.otp_verifications_id_seq;
DROP TABLE public.otp_verifications;
DROP SEQUENCE public.network_nodes_id_seq;
DROP TABLE public.network_nodes;
DROP SEQUENCE public.fraud_logs_id_seq;
DROP TABLE public.fraud_logs;
DROP SEQUENCE public.financial_ledger_id_seq;
DROP TABLE public.financial_ledger;
DROP SEQUENCE public.crypto_transactions_id_seq;
DROP TABLE public.crypto_transactions;
DROP SEQUENCE public.courses_id_seq;
DROP TABLE public.courses;
DROP SEQUENCE public.coupons_id_seq;
DROP TABLE public.coupons;
DROP SEQUENCE public.commissions_id_seq;
DROP TABLE public.commissions;
DROP SEQUENCE public.activity_feed_id_seq;
DROP TABLE public.activity_feed;
DROP SCHEMA public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_feed (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    amount numeric(12,2),
    related_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_feed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_feed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_feed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_feed_id_seq OWNED BY public.activity_feed.id;


--
-- Name: commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    source_user_id integer NOT NULL,
    bv_matched numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commissions_id_seq OWNED BY public.commissions.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    user_id integer NOT NULL,
    course_id integer,
    code text NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    redeemed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coupon_type text DEFAULT 'general'::text NOT NULL,
    generated_by text DEFAULT 'system'::text NOT NULL,
    expiry_date timestamp with time zone,
    redeemed_by integer
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    min_price numeric(12,2),
    max_price numeric(12,2),
    bv_amount numeric(12,2) DEFAULT '3000'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: crypto_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crypto_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tx_hash text NOT NULL,
    network text NOT NULL,
    from_address text,
    to_address text NOT NULL,
    amount numeric(18,6) NOT NULL,
    currency text DEFAULT 'USDT'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    webhook_source text,
    raw_payload text,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crypto_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crypto_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crypto_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crypto_transactions_id_seq OWNED BY public.crypto_transactions.id;


--
-- Name: financial_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_ledger (
    id integer NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: financial_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_ledger_id_seq OWNED BY public.financial_ledger.id;


--
-- Name: fraud_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fraud_logs (
    id integer NOT NULL,
    user_id integer,
    ip_address text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fraud_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fraud_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fraud_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fraud_logs_id_seq OWNED BY public.fraud_logs.id;


--
-- Name: network_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.network_nodes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    parent_id integer,
    sponsor_id integer,
    leg text,
    left_child_id integer,
    right_child_id integer,
    depth integer DEFAULT 0 NOT NULL,
    left_bv numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    right_bv numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: network_nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.network_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: network_nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.network_nodes_id_seq OWNED BY public.network_nodes.id;


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_verifications_id_seq OWNED BY public.otp_verifications.id;


--
-- Name: payment_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_submissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    payment_method text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sender_wallet_address text,
    transferred_amount numeric(12,2),
    blockchain_network text,
    payment_screenshot_url text,
    payment_date_time timestamp with time zone,
    payment_reference_number text,
    collector_name text,
    collector_id text,
    payment_date timestamp with time zone,
    remarks text,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_submissions_id_seq OWNED BY public.payment_submissions.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    device_id text NOT NULL,
    ip_address text NOT NULL,
    user_agent text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    mobile_number text,
    address text,
    country_code text DEFAULT 'US'::text,
    status text DEFAULT 'pending'::text NOT NULL,
    role text DEFAULT 'distributor'::text NOT NULL,
    referral_code text NOT NULL,
    referrer_id text,
    sponsor_id integer,
    package_type text,
    left_bv numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    right_bv numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    residual_left_bv numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    residual_right_bv numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id integer NOT NULL,
    wallet_id integer NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    reference_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total_earned numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_spent numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    available_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    pin_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: wash_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wash_events (
    id integer NOT NULL,
    executed_by integer NOT NULL,
    wallets_reset integer DEFAULT 0 NOT NULL,
    total_amount_wiped numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wash_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wash_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wash_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wash_events_id_seq OWNED BY public.wash_events.id;


--
-- Name: activity_feed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_feed ALTER COLUMN id SET DEFAULT nextval('public.activity_feed_id_seq'::regclass);


--
-- Name: commissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions ALTER COLUMN id SET DEFAULT nextval('public.commissions_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: crypto_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crypto_transactions ALTER COLUMN id SET DEFAULT nextval('public.crypto_transactions_id_seq'::regclass);


--
-- Name: financial_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_ledger ALTER COLUMN id SET DEFAULT nextval('public.financial_ledger_id_seq'::regclass);


--
-- Name: fraud_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_logs ALTER COLUMN id SET DEFAULT nextval('public.fraud_logs_id_seq'::regclass);


--
-- Name: network_nodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_nodes ALTER COLUMN id SET DEFAULT nextval('public.network_nodes_id_seq'::regclass);


--
-- Name: otp_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications ALTER COLUMN id SET DEFAULT nextval('public.otp_verifications_id_seq'::regclass);


--
-- Name: payment_submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_submissions ALTER COLUMN id SET DEFAULT nextval('public.payment_submissions_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Name: wash_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wash_events ALTER COLUMN id SET DEFAULT nextval('public.wash_events_id_seq'::regclass);


--
-- Data for Name: activity_feed; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_feed (id, user_id, type, message, amount, related_user_id, created_at) FROM stdin;
1	1	registration	Admin account initialized	\N	\N	2026-05-22 12:02:37.428274+00
2	1	commission_earned	Earned $25.00 direct referral commission	25.00	2	2026-05-22 12:02:37.428274+00
3	1	commission_earned	Earned $25.00 direct referral commission	25.00	3	2026-05-22 12:02:37.428274+00
4	1	binary_match	Binary match! 1 cycle completed — earned $70.00	70.00	\N	2026-05-22 12:02:37.428274+00
5	2	registration	Welcome! Your account has been activated.	\N	\N	2026-05-22 12:02:37.43368+00
6	3	registration	Welcome! Your account has been activated.	\N	\N	2026-05-22 12:02:37.438397+00
7	4	registration	Welcome! Your account has been activated.	\N	\N	2026-05-22 12:02:37.441745+00
8	5	registration	Welcome! Your account has been activated.	\N	\N	2026-05-22 12:02:37.445749+00
9	6	registration	Welcome! Your account has been activated.	\N	\N	2026-05-22 12:02:37.451586+00
10	7	registration	Welcome! Your account has been activated.	\N	\N	2026-05-22 12:02:37.456211+00
11	1	commission_earned	Earned $3.00 direct referral commission	3.00	8	2026-05-23 04:21:32.304945+00
12	8	registration	Welcome! Your account has been activated.	\N	\N	2026-05-23 04:21:32.319847+00
13	8	commission_earned	Earned $3.00 direct referral commission	3.00	9	2026-05-23 04:39:18.82286+00
14	9	registration	Welcome! Your account has been activated.	\N	\N	2026-05-23 04:39:18.83778+00
15	8	commission_earned	Earned $3.00 direct referral commission	3.00	10	2026-05-23 04:58:48.623792+00
16	10	registration	Welcome! Your account has been activated.	\N	\N	2026-05-23 04:58:48.632619+00
17	8	coupon_created	Generated coupon COUPON-HAUKVL-MLM worth $6	6.00	\N	2026-05-23 05:16:44.651104+00
18	10	coupon_redeemed	Redeemed coupon COUPON-HAUKVL-MLM worth $6	6.00	\N	2026-05-23 05:16:56.837367+00
19	1	commission_earned	Earned $100.00 direct referral commission	100.00	11	2026-05-23 09:37:29.906245+00
20	11	registration	Welcome! Your account has been auto-activated via referral.	\N	\N	2026-05-23 09:37:29.91191+00
21	11	coupon_redeemed	Redeemed coupon ADMIN-8R801H worth $1000	1000.00	\N	2026-05-23 09:38:34.788379+00
\.


--
-- Data for Name: commissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commissions (id, user_id, type, amount, source_user_id, bv_matched, created_at) FROM stdin;
1	1	direct_referral	3.00	8	\N	2026-05-23 04:21:32.28769+00
2	8	direct_referral	3.00	9	\N	2026-05-23 04:39:18.806662+00
3	8	direct_referral	3.00	10	\N	2026-05-23 04:58:48.613404+00
4	1	direct_referral	100.00	11	\N	2026-05-23 09:37:29.900538+00
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, user_id, course_id, code, amount, status, redeemed_at, created_at, coupon_type, generated_by, expiry_date, redeemed_by) FROM stdin;
1	8	\N	COUPON-HAUKVL-MLM	6.00	redeemed	2026-05-23 05:16:56.833+00	2026-05-23 05:16:44.648104+00	general	system	\N	\N
2	11	\N	ADMIN-8R801H	1000.00	redeemed	2026-05-23 09:38:34.785+00	2026-05-23 09:37:29.898773+00	general	system	\N	\N
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.courses (id, name, description, price, min_price, max_price, bv_amount, is_active, created_at, updated_at) FROM stdin;
1	Online Business Make Money Pro		1044.41	\N	\N	3000.00	t	2026-05-23 04:33:30.449078+00	2026-05-23 04:33:30.449078+00
2	starter	Starter Package	100.00	\N	\N	100.00	t	2026-05-23 04:55:35.129632+00	2026-05-23 04:55:35.129632+00
3	pro	Pro Package	500.00	\N	\N	500.00	t	2026-05-23 04:55:35.129632+00	2026-05-23 04:55:35.129632+00
4	elite	Elite Package	1000.00	\N	\N	1000.00	t	2026-05-23 04:55:35.129632+00	2026-05-23 04:55:35.129632+00
\.


--
-- Data for Name: crypto_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crypto_transactions (id, user_id, tx_hash, network, from_address, to_address, amount, currency, status, webhook_source, raw_payload, confirmed_at, created_at) FROM stdin;
\.


--
-- Data for Name: financial_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.financial_ledger (id, type, amount, description, user_id, created_at) FROM stdin;
1	inflow	30.00	Registration fee from test user	8	2026-05-23 04:21:32.280305+00
2	commission_paid	3.00	Direct referral commission (10%)	1	2026-05-23 04:21:32.309779+00
3	inflow	30.00	Registration fee from abshad abu	9	2026-05-23 04:39:18.801347+00
4	commission_paid	3.00	Direct referral commission (10%)	8	2026-05-23 04:39:18.827684+00
5	inflow	30.00	Registration fee from avinash you	10	2026-05-23 04:58:48.611015+00
6	commission_paid	3.00	Direct referral commission (10%)	8	2026-05-23 04:58:48.626823+00
7	commission_paid	100.00	Direct referral commission (10%)	1	2026-05-23 09:37:29.908094+00
\.


--
-- Data for Name: fraud_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fraud_logs (id, user_id, ip_address, reason, created_at) FROM stdin;
1	8	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 05:15:55.748073+00
2	10	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 08:48:22.470253+00
3	1	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 09:34:27.568775+00
4	1	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 09:35:58.051524+00
5	1	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 09:36:19.88883+00
6	11	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 09:37:45.888775+00
7	10	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 09:51:47.629136+00
8	10	::ffff:127.0.0.1	duplicate_ip_login	2026-05-23 10:32:06.00672+00
\.


--
-- Data for Name: network_nodes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.network_nodes (id, user_id, parent_id, sponsor_id, leg, left_child_id, right_child_id, depth, left_bv, right_bv, created_at, updated_at) FROM stdin;
5	5	2	1	right	\N	\N	2	0.00	0.00	2026-05-22 12:02:37.397935+00	2026-05-22 12:02:37.397935+00
6	6	3	1	left	\N	\N	2	0.00	0.00	2026-05-22 12:02:37.408753+00	2026-05-22 12:02:37.408753+00
7	7	3	1	right	\N	\N	2	0.00	0.00	2026-05-22 12:02:37.416491+00	2026-05-22 12:02:37.416491+00
3	3	1	1	right	6	7	1	30.00	30.00	2026-05-22 12:02:37.37302+00	2026-05-22 12:02:37.422+00
9	9	8	8	left	\N	\N	4	0.00	0.00	2026-05-23 04:39:18.758179+00	2026-05-23 04:39:18.758179+00
10	10	8	8	right	\N	\N	4	0.00	0.00	2026-05-23 04:58:48.587192+00	2026-05-23 04:58:48.587192+00
8	8	4	1	left	9	10	3	30.00	30.00	2026-05-23 04:21:32.247916+00	2026-05-23 04:58:48.596+00
11	11	4	1	right	\N	\N	3	0.00	0.00	2026-05-23 09:37:29.885753+00	2026-05-23 09:37:29.885753+00
4	4	2	1	left	8	11	2	90.00	1000.00	2026-05-22 12:02:37.391994+00	2026-05-23 09:37:29.892+00
2	2	1	1	left	4	5	1	1180.00	60.00	2026-05-22 12:02:37.36967+00	2026-05-23 09:37:29.894+00
1	1	\N	\N	\N	2	3	0	1270.00	120.00	2026-05-22 12:02:37.165297+00	2026-05-23 09:37:29.896+00
\.


--
-- Data for Name: otp_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_verifications (id, user_id, otp_hash, expires_at, is_verified, created_at) FROM stdin;
1	10	$2b$10$bp2aLgNCAvi9sJJc23jgJOWZO/jXP4EsN6zsjhoylUgFqN1P7BVvK	2026-05-23 05:10:59.444+00	f	2026-05-23 05:00:59.446849+00
2	10	$2b$10$hjoyNIjLgtUnSFNaPiQC4eWlPWWWYAoCw3c6lj1VlNYTcsogdiIMe	2026-05-23 05:11:11.865+00	f	2026-05-23 05:01:11.866174+00
3	1	$2b$10$QJwlZMHygLdkdTKsktpWHuIbOdoPS49RFyJRDmRlOWXm6GTaGVR9u	2026-05-23 05:11:46.199+00	f	2026-05-23 05:01:46.200773+00
4	10	$2b$10$P7w5NjItThQ/GNw61EXM/./e4Cyx6UEif/sEZRdtXS71I.CmicX.W	2026-05-23 05:22:18.613+00	f	2026-05-23 05:12:18.61482+00
5	10	$2b$10$oBDP31ywlEXmJ9WGAaYkiexcirpdYy5VeUKWnVyYzFc3LS7lf2TZS	2026-05-23 05:24:32.648+00	t	2026-05-23 05:14:32.649483+00
6	8	$2b$10$5jDE356XDkf/Nd/WqE4nLuDfKFCQENDoysEiBqXJRQOauSGgVWnKi	2026-05-23 05:25:55.742+00	t	2026-05-23 05:15:55.743067+00
7	10	$2b$10$LoS1IK8sNXxJCFwCQwBNu.8rQsM5/cAe0UJZ24uR7dxpulBkoaeZu	2026-05-23 08:58:22.461+00	f	2026-05-23 08:48:22.464407+00
8	1	$2b$10$e1T8.iWkZVBptN1c80wt0.tW8rrGrmbu1/ej/jg3G33cngeRIR3le	2026-05-23 09:44:27.562+00	f	2026-05-23 09:34:27.563588+00
9	1	$2b$10$EW7eC.8FJ6lZAaKri0CBv.JoPP17E72r0G.vdVLhtHpCbDrZQFtNO	2026-05-23 09:45:58.044+00	f	2026-05-23 09:35:58.04591+00
10	1	$2b$10$dqJ62aLgndhjb9vszelvr.fbDjPTmw3/hpFWPLUi/p96Mz/lrwfMS	2026-05-23 09:46:19.883+00	t	2026-05-23 09:36:19.884217+00
11	11	$2b$10$ByWUH4EI4ISoaj4Foa2HPO2npAh3XoQt4.eb24EgRa6m97xYxvzXm	2026-05-23 09:47:45.883+00	t	2026-05-23 09:37:45.883744+00
12	10	$2b$10$HwUGoHJSddy3WudWDpBycOgGEZyMa09iAA.06sIMx4LfiJIWNCkvy	2026-05-23 10:01:47.621+00	t	2026-05-23 09:51:47.622791+00
13	10	$2b$10$e/rguy3u8msoxXjH17P83um15cwgOvk3kLg4OfRePuE6iEJfwyrLC	2026-05-23 10:42:05.999+00	t	2026-05-23 10:32:06.001067+00
\.


--
-- Data for Name: payment_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_submissions (id, user_id, payment_method, status, sender_wallet_address, transferred_amount, blockchain_network, payment_screenshot_url, payment_date_time, payment_reference_number, collector_name, collector_id, payment_date, remarks, reviewed_by, reviewed_at, rejection_reason, created_at) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_sessions (id, user_id, device_id, ip_address, user_agent, is_active, last_active_at, created_at) FROM stdin;
1	10	unknown_device	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	t	2026-05-23 05:15:26.766815+00	2026-05-23 05:15:26.766815+00
2	8	unknown_device	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0	t	2026-05-23 05:16:10.845465+00	2026-05-23 05:16:10.845465+00
3	1	unknown_device	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0	t	2026-05-23 09:36:28.474809+00	2026-05-23 09:36:28.474809+00
4	11	unknown_device	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	t	2026-05-23 09:37:57.290162+00	2026-05-23 09:37:57.290162+00
5	10	unknown_device	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0	t	2026-05-23 09:51:55.658075+00	2026-05-23 09:51:55.658075+00
6	10	unknown_device	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0	t	2026-05-23 10:34:05.44345+00	2026-05-23 10:34:05.44345+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, first_name, last_name, mobile_number, address, country_code, status, role, referral_code, referrer_id, sponsor_id, package_type, left_bv, right_bv, residual_left_bv, residual_right_bv, created_at, updated_at) FROM stdin;
1	admin@netpro.com	$2b$10$mbRDgfej4wAbYggEIfuLheDbfpXESixL0FEuwxz5CCJ2V0Mc3dLMW	Admin	NetPro	+1-555-0001	100 HQ Boulevard, Network City	US	active	admin	ADMIN001	\N	\N	elite	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.139831+00	2026-05-22 12:02:37.139831+00
3	bob@demo.com	$2b$10$l.ZGck6EBrxJ9yQoVi1Bje..CbhAUsBtHe0bCjtChJKAETuC4WDle	Bob	Smith	+1-555-1001	2 Demo Street	US	active	distributor	BOB00001	ADMIN001	1	starter	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.298403+00	2026-05-22 12:02:37.298403+00
4	carol@demo.com	$2b$10$l.ZGck6EBrxJ9yQoVi1Bje..CbhAUsBtHe0bCjtChJKAETuC4WDle	Carol	Davis	+1-555-1002	3 Demo Street	US	active	distributor	CAROL001	ADMIN001	1	elite	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.314805+00	2026-05-22 12:02:37.314805+00
5	david@demo.com	$2b$10$l.ZGck6EBrxJ9yQoVi1Bje..CbhAUsBtHe0bCjtChJKAETuC4WDle	David	Wilson	+1-555-1003	4 Demo Street	US	active	distributor	DAVID001	ADMIN001	1	pro	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.329341+00	2026-05-22 12:02:37.329341+00
6	eve@demo.com	$2b$10$l.ZGck6EBrxJ9yQoVi1Bje..CbhAUsBtHe0bCjtChJKAETuC4WDle	Eve	Martinez	+1-555-1004	5 Demo Street	US	active	distributor	EVE00001	ADMIN001	1	starter	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.341968+00	2026-05-22 12:02:37.341968+00
7	frank@demo.com	$2b$10$l.ZGck6EBrxJ9yQoVi1Bje..CbhAUsBtHe0bCjtChJKAETuC4WDle	Frank	Brown	+1-555-1005	6 Demo Street	US	active	distributor	FRANK001	ADMIN001	1	pro	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.357604+00	2026-05-22 12:02:37.357604+00
8	test@gmail.com	$2b$10$WWvmx7X9u6MRh.uiU1lpZOBM0/NZvJiYS30C3lRAZVKCL3OI.4gqC	test	user	8238482738	hoogo street bulding 1	US	active	distributor	2F2TTKVR	ADMIN001	1	elite	0.00	0.00	0.00	0.00	2026-05-23 04:20:09.503461+00	2026-05-23 04:21:32.225+00
2	alice@demo.com	$2b$10$l.ZGck6EBrxJ9yQoVi1Bje..CbhAUsBtHe0bCjtChJKAETuC4WDle	Alice	Johnson	+1-555-1000	1 Demo Street	US	active	distributor	ALICE001	ADMIN001	1	pro	0.00	0.00	0.00	0.00	2026-05-22 12:02:37.280756+00	2026-05-23 04:28:55.951+00
9	abu@gmail.com	$2b$10$T9U40Jz.SdWJKvJAsRK.4Op02NdfVC6NVMVUbn65sENyvckK0ZmFK	abshad	abu	30282018290	123 main st stree	US	active	distributor	VZI389WC	2F2TTKVR	8	pro	0.00	0.00	0.00	0.00	2026-05-23 04:37:58.289074+00	2026-05-23 04:39:18.735+00
10	You@example.com	$2b$10$I/VNbMcp1QLY/CIy.udfKOx9WoWGmSE0aAIQWloJJHiWIeAoBIBhG	avinash	you	9032439239	church street sm 21	US	active	distributor	HWYCGHGX	2F2TTKVR	8	pro	0.00	0.00	0.00	0.00	2026-05-23 04:58:19.185221+00	2026-05-23 04:58:48.574+00
11	demo@example.com	$2b$10$NuJrlvLh/cvtZz3MR/y2JOWD1y6ESlJzQwVOyDh1oZWkZiYXmnWmC	demo 	user	3902202039	don bosco city	US	active	distributor	BHE5WXI1	ADMIN001	1	elite	0.00	0.00	0.00	0.00	2026-05-23 09:37:29.873178+00	2026-05-23 09:37:29.873178+00
\.


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_transactions (id, wallet_id, type, amount, description, reference_id, created_at) FROM stdin;
1	1	credit	3.00	Direct referral commission (10%) from user #8	commission_8	2026-05-23 04:21:32.298891+00
2	8	credit	3.00	Direct referral commission (10%) from user #9	commission_9	2026-05-23 04:39:18.818147+00
3	8	credit	3.00	Direct referral commission (10%) from user #10	commission_10	2026-05-23 04:58:48.619825+00
4	8	debit	6.00	Coupon generated for $6	\N	2026-05-23 05:16:44.645376+00
5	1	credit	100.00	Direct referral commission (10%) from user #11	commission_11	2026-05-23 09:37:29.904623+00
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, user_id, total_earned, total_spent, available_balance, pin_hash, created_at, updated_at) FROM stdin;
2	2	25.00	0.00	25.00	\N	2026-05-22 12:02:37.289122+00	2026-05-22 12:02:37.289122+00
3	3	50.00	0.00	50.00	\N	2026-05-22 12:02:37.306414+00	2026-05-22 12:02:37.306414+00
4	4	75.00	0.00	75.00	\N	2026-05-22 12:02:37.322145+00	2026-05-22 12:02:37.322145+00
5	5	100.00	0.00	100.00	\N	2026-05-22 12:02:37.336067+00	2026-05-22 12:02:37.336067+00
6	6	125.00	0.00	125.00	\N	2026-05-22 12:02:37.348487+00	2026-05-22 12:02:37.348487+00
7	7	150.00	0.00	150.00	\N	2026-05-22 12:02:37.364565+00	2026-05-22 12:02:37.364565+00
9	9	0.00	0.00	0.00	\N	2026-05-23 04:38:24.297499+00	2026-05-23 04:38:24.297499+00
10	10	0.00	0.00	0.00	\N	2026-05-23 04:58:48.579116+00	2026-05-23 04:58:48.579116+00
8	8	6.00	6.00	0.00	$2b$10$/Fvs9aKiyk8deJyvSOqreOIqgYUguWKXagwmVXi1mWVfG9D1I37K2	2026-05-23 04:20:40.418579+00	2026-05-23 05:16:44.64+00
11	11	0.00	0.00	0.00	\N	2026-05-23 09:37:29.878867+00	2026-05-23 09:37:29.878867+00
1	1	603.00	50.00	553.00	\N	2026-05-22 12:02:37.156123+00	2026-05-23 09:37:29.902+00
\.


--
-- Data for Name: wash_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wash_events (id, executed_by, wallets_reset, total_amount_wiped, reason, created_at) FROM stdin;
\.


--
-- Name: activity_feed_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_feed_id_seq', 21, true);


--
-- Name: commissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commissions_id_seq', 4, true);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupons_id_seq', 2, true);


--
-- Name: courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.courses_id_seq', 4, true);


--
-- Name: crypto_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.crypto_transactions_id_seq', 1, false);


--
-- Name: financial_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.financial_ledger_id_seq', 7, true);


--
-- Name: fraud_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fraud_logs_id_seq', 8, true);


--
-- Name: network_nodes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.network_nodes_id_seq', 11, true);


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_verifications_id_seq', 13, true);


--
-- Name: payment_submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_submissions_id_seq', 1, false);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 11, true);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallet_transactions_id_seq', 5, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallets_id_seq', 11, true);


--
-- Name: wash_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wash_events_id_seq', 1, false);


--
-- Name: activity_feed activity_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_feed
    ADD CONSTRAINT activity_feed_pkey PRIMARY KEY (id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_unique UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: crypto_transactions crypto_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crypto_transactions
    ADD CONSTRAINT crypto_transactions_pkey PRIMARY KEY (id);


--
-- Name: crypto_transactions crypto_transactions_tx_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crypto_transactions
    ADD CONSTRAINT crypto_transactions_tx_hash_unique UNIQUE (tx_hash);


--
-- Name: financial_ledger financial_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_ledger
    ADD CONSTRAINT financial_ledger_pkey PRIMARY KEY (id);


--
-- Name: fraud_logs fraud_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_logs
    ADD CONSTRAINT fraud_logs_pkey PRIMARY KEY (id);


--
-- Name: network_nodes network_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_nodes
    ADD CONSTRAINT network_nodes_pkey PRIMARY KEY (id);


--
-- Name: network_nodes network_nodes_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_nodes
    ADD CONSTRAINT network_nodes_user_id_unique UNIQUE (user_id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: payment_submissions payment_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_submissions
    ADD CONSTRAINT payment_submissions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id);


--
-- Name: wash_events wash_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wash_events
    ADD CONSTRAINT wash_events_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict weairJbDCYj2uWTGjZyrLCzNOfXJxqXlbS7n6N9fHEoHqnRVpOcpxmdPvYr1vde

