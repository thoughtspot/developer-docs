#!/bin/bash

# Color codes for better logging visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# This script is executed before the build starts.

# Function to install packages with retry and logging
install_deps() {
    local dependencies=("$@")

    for dep in "${dependencies[@]}"; do
        echo -e "${BLUE}Installing package: $dep...${RESET}"

        # First try apt-get installation
        if apt-get update && apt-get install -y "$dep"; then
            echo -e "${GREEN}$dep installed successfully with apt-get.${RESET}"
        else
            echo -e "${RED}apt-get failed. Trying to install $dep with brew...${RESET}"

            # Fallback to brew if apt-get fails
            if command -v brew &> /dev/null; then
                if brew install "$dep"; then
                    echo -e "${GREEN}$dep installed successfully with brew.${RESET}"
                else
                    echo -e "${RED}Failed to install $dep with brew.${RESET}"
                    exit 1
                fi
            else
                echo -e "${RED}brew is not installed. Failed to install $dep.${RESET}"
                exit 1
            fi
        fi
    done
}

# Main script execution
echo -e "${BLUE}Starting package installations...${RESET}"

# List of dependencies to install
dependencies=("jq")

install_deps "${dependencies[@]}"  # Pass the list of dependencies to the function

# install jq if not already installed via install_deps
echo -e "${YELLOW}Installing jq...${RESET}"
apt-get update && apt-get install -y jq

# Get the current git branch
current_branch=$(git branch --show-current)

# 0. Get a list of branches as an array of strings from the config file
branches=($(jq -r '.branches[]' build-config.json))

# Clean the branch_content folder
echo -e "\n${YELLOW}Cleaning the branch_content folder...${RESET}"
mkdir -p branch_content
echo -e "${GREEN}Cleaning branch_content folder completed.${RESET}"

# 1. Copy the modules from other git branches
for branch in "${branches[@]}"
do
    echo -e "\n${BLUE}Processing branch: $branch...${RESET}"
    git fetch origin $branch
    rm -rf modules/ROOT/pages
    echo -e "${YELLOW}Copying modules from branch: $branch...${RESET}"
    git checkout $branch -- modules/ROOT/pages
    mkdir -p branch_content/$branch
    cp -r modules/ROOT/pages/* branch_content/$branch
    echo -e "${GREEN}Completed processing for branch: $branch.${RESET}"
    git checkout $current_branch -- modules/ROOT/pages
    # 3. Update the path variable in the ascidoc file (you can add the code for this here)
done

# 4. Copy the modules from branch_content to the modules folder
echo -e "\n${BLUE}Copying the modules from branch_content to modules folder...${RESET}"
cp -r branch_content modules/ROOT/pages
echo -e "${GREEN}Copying modules from branch_content to modules folder completed.${RESET}"


echo -e "${GREEN}Script execution completed.${RESET}"
