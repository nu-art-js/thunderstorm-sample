#!/bin/bash

#!/bin/bash

# Check if nvm is installed, if not install it
if [ -z "$NVM_DIR" ] || [ ! -e "$NVM_DIR" ]; then
  echo "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
else
  echo "nvm is already installed"
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
# Install the required Node.js version
nvm install
nvm use

# Check if pnpm is installed, if not install it
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
else
  echo "pnpm is already installed"
fi

additionalFlags=''

# run over all params and look for fresh start param
for arg in "$@"; do
  if [[ $arg == "--fresh-start" || $arg == "-fs" ]]; then
    freshStart=true
    break
  fi
done

TS_VERSION=0.300.8

# Create Minimal packageJSON if doesn't exists
if [[ ${freshStart} || ! -e "./package.json" ]]; then
#	cat <<EOF >package.json
#{
#	"name": "temp",
#	"version": "0.0.1",
#	"devDependencies": {
#		"@types/node": "^18.15.0",
#		"@nu-art/build-and-install": "file:_thunderstorm/build-and-install/dist",
#		"@nu-art/commando": "file:_thunderstorm/commando/dist",
#		"@nu-art/ts-common": "file:_thunderstorm/ts-common/dist"
#	}
#}
#EOF

	cat <<EOF >package.json
{
	"name": "temp",
	"version": "0.0.1",
	"devDependencies": {
		"@types/node": "^18.15.0",
		"@nu-art/build-and-install": "~0.300.8",
		"@nu-art/commando": "~0.300.8",
		"@nu-art/ts-common": "~0.300.8"
	}
}
EOF
	additionalFlags+='-p -ip'
  rm package-lock.json
  rm pnpm-lock.yaml
  rm -rf node_modules
  npm i -g ts-node@latest typescript@5.0.4 firebase-tools@latest
	npm i
fi


if [[ $1 == "-bai" ]]; then
#  rm -rf "$(pwd)/node_modules/.pnpm/@nu-art+ts-common@${TS_VERSION}/node_modules/@nu-art/ts-common"
#  rm -rf "$(pwd)/node_modules/.pnpm/@nu-art+commando@${TS_VERSION}/node_modules/@nu-art/commando"
#  rm -rf "$(pwd)/node_modules/.pnpm/@nu-art+build-and-install@${TS_VERSION}/node_modules/@nu-art/build-and-install"
#
#  ln -s "$(pwd)/_thunderstorm/ts-common/dist" "$(pwd)/node_modules/.pnpm/@nu-art+ts-common@${TS_VERSION}/node_modules/@nu-art/ts-common"
#  ln -s "$(pwd)/_thunderstorm/commando/dist" "$(pwd)/node_modules/.pnpm/@nu-art+commando@${TS_VERSION}/node_modules/@nu-art/commando"
#  ln -s "$(pwd)/_thunderstorm/build-and-install/dist" "$(pwd)/node_modules/.pnpm/@nu-art+build-and-install@${TS_VERSION}/node_modules/@nu-art/build-and-install"

	ts-node "$(pwd)/_thunderstorm/build-and-install/src/main/build-and-install.ts" $@ $additionalFlags
else
	ts-node "$(npm root)/@nu-art/build-and-install/build-and-install.js" $@ $additionalFlags
fi


