# Config deltas

`deploy.sh deploy` and `deploy.sh full` walk these files after the backend Cloud Run revision is serving, and before the `env/<env>` tag moves.

One file per version: `releases/<semver>.json` (for example `releases/1.0.1.json`), committed on the `v<semver>` tag.

Storm on Cloud Run reads `/_config/default` then `/_config/app` (local still reads `/_config/local`). The frontend Hosting app reads `/_config/frontend/manager.json` — that path is **not** walked by `releases/*.json`. Seed it once on the RTDB (see below). Do not put mongo URLs or other secrets in git.

```json
{
  "default": {
    "ModuleBE_AppModule": {
      "httpServer": {
        "cors": {
          "headers": ["authorization", "tab-id", "device-id"],
          "methods": ["GET", "POST", "DELETE", "PUT", "PATCH"],
          "origins": [
            "https://<staging-hosting>.web.app",
            "https://<product-domain>"
          ],
          "responseHeaders": ["x-auth-token"]
        }
      }
    }
  },
  "app": {
    "HttpServer": {
      "baseUrl": "https://api-<project-number>.us-central1.run.app",
      "cors": {
        "origins": [
          "https://<staging-hosting>.web.app",
          "https://<product-domain>"
        ]
      }
    },
    "ModuleBE_AccountDB": {
      "canRegister": true
    },
    "ModuleBE_SessionDB": {
      "jwtSigner": {
        "projectId": "<staging-project-id>"
      }
    }
  }
}
```

Seed `/_config/frontend/manager` on the RTDB (public read via database rules). Shape from Beamz staging, flattened to this template's single `manager.json`:

```json
{
  "ModuleFE_App": {
    "serverUrl": "https://api-<project-number>.us-central1.run.app"
  },
  "ModuleFE_Thunderstorm": {
    "appName": "<Product> (STAGING)"
  },
  "ModuleFE_FirebaseListener": {
    "firebaseConfig": {
      "apiKey": "<web-app-api-key>",
      "appId": "<web-app-id>",
      "authDomain": "<staging-project-id>.firebaseapp.com",
      "databaseURL": "https://<staging-project-id>-default-rtdb.firebaseio.com",
      "messagingSenderId": "<project-number>",
      "projectId": "<staging-project-id>",
      "storageBucket": "<staging-project-id>.firebasestorage.app"
    }
  }
}
```

`ModuleBE_Firebase.mongo.mongoUrl` lives only in `/_config/app` on the RTDB. Never commit it.

Only `default` and `app` in `releases/*.json`. Each is a module name mapped to keys to merge. Nested objects deep-merge. Arrays and scalars replace. A `null` deletes that path. Firebase keys cannot contain `.` `$` `[` `]` `#` `/`.

`build` does not apply deltas. Shipping the same version twice does not patch again. A lower target does not roll deltas back.

Do not PATCH `/_config` by hand except the first frontend/manager seed and secrets such as mongo.
