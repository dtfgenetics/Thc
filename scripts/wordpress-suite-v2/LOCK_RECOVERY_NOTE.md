# Public Suite lock recovery

The canonical WordPress V2 deployer applies upload-lock recovery through `scripts/wordpress_suite_registry_patch.py` after the hash-pinned base bridge has been assembled.

This keeps the production transaction serialized while allowing the same untouched upload transaction to recover when Hostinger/WordPress temporarily loses visibility of the small option used as the deployment lease between `/init` and `/chunk`.

Recovery is permitted only while the transaction is still in the non-mutating `uploading` phase and no different deployment owns the lock. Once live-target mutation has begun, lock loss remains a hard failure.
