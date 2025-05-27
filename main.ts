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

		if (!this.settings.local)
		{
		}

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

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
			id: 'spit_out_reply',
			name: 'Query Local LLM (non-RAG)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				const prompt = editor.getSelection();

				if (!prompt) {
					new Notice("No prompt selected!");
					return;
				}

				const test = await ollama.chat({ model: 'deepseek-r1:7b', messages: [{role: 'user', content: JSON.stringify(prompt)}] });
				editor.replaceSelection(JSON.stringify(test.message.content));
			}
		});
		this.addCommand({
			id: 'spit_out_reply_simple_rule',
			name: 'Query Local LLM (with simple rules)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const prompt = editor.getSelection();
				const ruleFilePath = "dishragrules.md";
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

				const gen_prompt = JSON.stringify(prompt).concat(JSON.stringify(ruleGenContext));

				new Notice('Generating Response!');
				const test = await ollama.chat({ model: 'deepseek-r1:7b', messages: [{role: 'user', content: gen_prompt}] });
				editor.replaceSelection(test.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());
			}
		});
		this.addCommand({
			id: 'spit_out_reply_plaintext_rag',
			name: 'Query Local LLM (with plaintext RAG)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const prompt = editor.getSelection();
				const ragFilePath = `${this.settings.rules_dir}dishragrules.md`;
				const ruleFile = this.app.vault.getFileByPath(ragFilePath);

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

				let plain_rag_context = "";
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

				new Notice("Added context from the current Obsidian Vault!")

				const rules = await this.app.vault.read(ruleFile);

				const gen_prompt = JSON.stringify(plain_rag_context).concat(JSON.stringify(prompt).concat(JSON.stringify(rules)));


				if (this.settings.local)
				{
					new Notice(`Generating Response with local LLM ${this.settings.model}!`);
					response = await ollama.chat({ model: this.settings.model, messages: [{role: 'user', content: gen_prompt}] });
				} else {
					new Notice(`Generating Response with web LLM ${this.settings.model}!`);
					const openai = new OpenAI({apiKey: this.settings.api_key})

					const result = await openai.chat.completions.create({ model: this.settings.model, store: true, messages: [{"role": 'user', "content": gen_prompt}] });
					response = result.choices[0].message
				}

				if (response == null) {
					new Notice('Error accessing the model!');
					editor.replaceSelection('Error')

				}
				editor.replaceSelection(response.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
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
