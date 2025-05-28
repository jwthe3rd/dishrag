# Dynamic Inference via Snippets and Highlights (DISH) RAG


### Mission

* Make a RAG based prompter plugin for Obsidian using local LLMs through ollama

### Researchers

* This should be a good tool for researchers to query an Obsidian database of notes on literature as well as their own results and observations


#### Note this is still very new and very much in an experimental phase

### Requirements

* node.js

### How to test

* clone the git repo
* from within the repo, run "npm install" to install the prerequisite JS libraries
* copy it into your plugins folder at "${YOUR_VAULT}/.obsidian/plugins/"
* be sure to enable community plugins in your obsidian settings

### Current capability

* Write down your query in the current document, then highlight and issue either of the two commands below...

* Use the command (via Ctrl+P in Obsidian) Query Local LLM (with simple Rules) to query a rules file titled "dishragrules" for outputs using your set LLM with no RAG.

* Use the command Query Local LLM (with plaintext RAG) to scrape your current Obsidian vault to add context to your response from the LLM

##### Note currently only directly supports local ollama deepseek and openai using api keys
### Example Scenario

* As part of my research I have looked into the fluid dynamics of coronary artery disease, which has an associated metric called Coronary Flow Reserve (CFR). As a result, I have notes in my Obsidian vault on the topic.

<img src="./docs/out.gif"/>
