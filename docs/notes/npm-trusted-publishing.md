# npm trusted publishing

`release.yml` publishes with no stored token. GitHub Actions mints an
OIDC token (`id-token: write`), npm exchanges it for a short-lived
publish token, and `--provenance` attaches a build attestation. Each
package on npm names this repository and `release.yml` as its trusted
publisher.

## Setting it up for a new package

The first version of a package has to be published by hand, because a
trusted publisher can only be attached to a package that exists. After
that, from a logged-in machine:

```bash
npx -y npm@latest trust github <package> --repo scampdesign/scampjs --file release.yml --allow-publish
npm trust list <package>
```

`--allow-publish` matters. The registry requires every trusted
publisher to carry a `permissions` list (`createPackage` for
`npm publish`, `createStagedPackage` for `npm stage publish`). The
`npm trust` command that ships with Node 24's npm 11 predates that
field, sends none, and gets a bare `400 Bad Request` with the reason
hidden. The web form's "Allow npm publish" checkbox is the same field.

## Reading a failure

A publish that fails with `404 Not Found - PUT …` after "Provenance
statement published" means the OIDC exchange failed and npm fell back
to no credentials. Add `--loglevel verbose` to the publish step to see
the exchange result; `OIDC token exchange error - package not found`
means no trusted publisher matches the run's repository, workflow
filename, and environment.

The registry answers a successful publish with `202` and "Your package
is being processed"; the version and its attestations appear a few
minutes later.
