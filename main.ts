import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import ollama from 'ollama'
import OpenAI from 'openai';
// Remember to rename these classes and interfaces!
//


interface PluginSettings {
	local: boolean;
	model: string;
	api_key: string;
	vault_root_dir_for_search: string;
	rules_dir: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	local: true,
	model: 'deepseek-r1:7b',
	api_key: 'null',
	vault_root_dir_for_search: '',
	rules_dir: ''

}

export default class DishRAGPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('dice', 'Greet', async () => {
			try {
			const test = await ollama.embeddings({ model: 'nomic-embed-text', prompt: 'The sky is blue because of rayleigh scattering' });
			new Notice(JSON.stringify(test,null,2));
			} catch (err) {
				console.error('Error generating embeddings', err);
				new Notice('Error in ollama');
			}
		});

		this.addCommand({
			id: 'spit_out_reply_simple_rule',
			name: 'Query Local LLM (with simple rules)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const prompt = editor.getSelection();
				const ruleFilePath = `${this.settings.rules_dir}dishragrules.md`;
				const file = this.app.vault.getFileByPath(ruleFilePath);

				new Notice('Successfully read rules file!');

				if (!prompt) {
					new Notice("No prompt selected!");
					return;
				}

				if (file === null)
				{
					new Notice("Rule file is not present!");
					return;
				}

				const content = await this.app.vault.read(file);

				const ruleGenContext = content;//await ollama.embeddings({model: 'nomic-embed-text', prompt: JSON.stringify(content)});
				let response: any = null;

				const gen_prompt = JSON.stringify(prompt).concat(JSON.stringify(ruleGenContext));

				if (this.settings.local)
				{
					new Notice(`Generating Response with local LLM ${this.settings.model}!`);
					response = await ollama.chat({ model: this.settings.model, messages: [{role: 'user', content: gen_prompt}] });
					/*const result = await fetch("http://localhost:11434/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: this.settings.model,
						messages: [
							{role: 'user',
							content: gen_prompt} ]
					}),
					});

					const response = await result.json();*/

					editor.replaceSelection(response.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());

				} else {
					new Notice(`Generating Response with web LLM ${this.settings.model}!`);
					const openai = new OpenAI({apiKey: this.settings.api_key})

					const result = await openai.chat.completions.create({ model: this.settings.model, store: true, messages: [{"role": 'user', "content": gen_prompt}] });
					response = result.choices[0].message
					editor.replaceSelection(response);
				}
			}
		});
		this.addCommand({
			id: 'spit_out_reply_plaintext_rag',
			name: 'Query Local LLM (with plaintext RAG)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const prompt = editor.getSelection();
				const ruleFilePath = `${this.settings.rules_dir}dishragrules.md`;
				const ruleFile = this.app.vault.getFileByPath(ruleFilePath);

				new Notice('Successfully read rules file!');

				if (!prompt) {
					new Notice("No prompt selected!");
					return;
				}

				if (ruleFile === null)
				{
					new Notice("Rules file is not present at specified location!");
					return;
				}

				let plain_rag_context = "Everything here is background information until I tell you otherwise";
				let response: any = null;

				for (const file of this.app.vault.getMarkdownFiles())
				{
					if (file.path.startsWith('Templates/')) continue;
					if (file.path.startsWith(this.settings.vault_root_dir_for_search))
					{
						const content = await this.app.vault.read(file);
						plain_rag_context += `\n\n --- \n# ${file.basename}\n\n${content}`;
					}
				}
				plain_rag_context += `\n \n Now this is the end of the background material, next is the prompt that I would like you to answer! \n \n`

				new Notice("Added context from the current Obsidian Vault!")

				const rules = await this.app.vault.read(ruleFile);

				const gen_prompt = JSON.stringify(rules).concat(JSON.stringify(plain_rag_context).concat(JSON.stringify(prompt)));


				if (this.settings.local)
				{
					new Notice(`Generating Response with local LLM ${this.settings.model}!`);
					response = await ollama.chat({ model: this.settings.model, messages: [{role: 'user', content: gen_prompt}] });
					/*const result = await fetch("http://localhost:11434/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: this.settings.model,
						messages: [
							{role: 'user',
							content: gen_prompt} ]
					}),
					});

					const response = await result.json();*/

					editor.replaceSelection(response.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());

				} else {
					new Notice(`Generating Response with web LLM ${this.settings.model}!`);
					const openai = new OpenAI({apiKey: this.settings.api_key})

					const result = await openai.chat.completions.create({ model: this.settings.model, store: true, messages: [{"role": 'user', "content": gen_prompt}] });
					response = result.choices[0].message
					editor.replaceSelection(response);
				}

			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DishRAGSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class DishRAGSettingTab extends PluginSettingTab {
	plugin: DishRAGPlugin;

	constructor(app: App, plugin: DishRAGPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Locality')
			.setDesc('Set whether your model is local or web')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.local)
				.onChange(async (value) => {
					this.plugin.settings.local = value;
					await this.plugin.saveSettings();

					this.display();
				}));
		new Setting(containerEl)
			.setName('Model')
			.setDesc('Input the model name in ollama (if local)')
			.addText(text => text
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Path to root folder for RAG generation (relative to vault directory)')
			.setDesc('Path to data (default is the entire vault)')
			.addText(text => text
				.setValue(this.plugin.settings.vault_root_dir_for_search)
				.onChange(async (value) => {
					this.plugin.settings.vault_root_dir_for_search = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Path to root folder with dishragrules file (relative to vault directory)')
			.setDesc('Path to data (default is the base directory of the vault)')
			.addText(text => text
				.setValue(this.plugin.settings.rules_dir)
				.onChange(async (value) => {
					this.plugin.settings.rules_dir = value;
					await this.plugin.saveSettings();
				}));
		if (!this.plugin.settings.local)
		{new Setting(containerEl)
			.setName('OpenAI api key')
			.setDesc('Enter your api key for the OpenAI interface')
			.addText(text => text
				.setValue(this.plugin.settings.api_key)
				.onChange(async (value) => {
					this.plugin.settings.api_key = value;
					await this.plugin.saveSettings();
				}));}
	}
}
