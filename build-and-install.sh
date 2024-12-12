#!/bin/bash

# Check if nvm is installed, if not install it
if [ -z "$NVM_DIR" ]; then
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

# Create Minimal packageJSON if doesn't exists
[[ $1 == "--fresh-start" || $1 == "-fs" ]] && freshStart=true
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
    "ts-node": "^10.9.1",
		"@nu-art/build-and-install": "latest",
		"@nu-art/commando": "latest",
		"@nu-art/ts-common": "latest"
	}
}
EOF
	additionalFlags+=' -ip'
  rm package-lock.json
  rm -rf node_modules
  npm i -g ts-node@latest typescript@latest firebase-tools@latest
	npm i
fi

if [[ $1 == "-bai" ]]; then
	ts-node "$(pwd)/_thunderstorm/build-and-install/src/main/build-and-install.ts" $@ $additionalFlags
else
	ts-node "$(npm root)/@nu-art/build-and-install/build-and-install.js" $@ $additionalFlags
fi


