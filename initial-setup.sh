#!/bin/bash

bash build-and-install.sh -fs -th -p -cox
bash build-and-install.sh --local
bash build-and-install.sh --backup
bash build-and-install.sh -i -all

