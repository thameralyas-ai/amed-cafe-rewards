# RETIRED (security hardening, Nov 2026).
#
# This script used to build a public data.json that held every member's card (first name, member code,
# visit history) keyed by PBKDF2(PIN, phone). Anyone could download that file and, for a known phone
# number, try all 10,000 PINs offline in seconds. data.json has been deleted from the site and must
# never be published again.
#
# Customer cards are now served only from Firestore (cards/<key>, single-document reads, no listing),
# and the public cafe info from Firestore public/meta; the staff tool keeps both up to date itself.
#
# The script is kept (instead of deleted) only so that an old scheduled job that still calls it
# fails safely: it writes nothing and exits with an error, so nothing is committed.
import sys

sys.stderr.write(
    "tools/sync.py is retired: data.json exposed customer records and is no longer published.\n"
    "Cards are served from Firestore by the staff tool. Disable the 'hourly customer-page update' task.\n"
)
sys.exit(2)
