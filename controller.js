import {TokenType,Debugger} from "./Debugger.js";
import {Settings} from "./Settings.js";

const PAUSE_BUTTON_TEXT = "Pause";
const PLAY_BUTTON_TEXT = "Run";
const MIN_CELLS = 50;
const Mode = Object.freeze({
	// User is editing code
	"EDIT_MODE":1,
	// Transitioning between modes
	"TRANSITION_MODE":2,
	// User is stepping
	"DEBUG_MODE":3,
	// User is running the program (not stepping)
	"PLAY_MODE":4,
	// Program is waiting for user input
	"INPUT_MODE":5,
});

// Common DOM elements
const dom_elements=
{
	hamburger_menu : document.querySelector(".hamburger-menu"),
	hamburger_button : document.querySelector(".hamburger-button"),
	settings_modal : document.querySelector("#settings-modal"),
};

let mode = Mode.EDIT_MODE;
const debug = new Debugger();
const settings = new Settings(updateSettings);
// Highest_cell is used to determine
// how many (DOM)cells we have already placed
// on the (DOM)tape
let highest_cell = -1;
// Input buffer
// User produces via iobox
// BF program consumes
const input_queue = []; 
// Used to determine which state we switched
// from when switching to Input Mode
let last_state;
// Last mark put down
// (for highlighting during debugging)
let mark;
// The time we wait between steps when debugging
let step_delay=0;

const code_editor = CodeMirror(document.querySelector("#edit-panel-container"),
	{
		lineWrapping: true,
		spellCheck:false,
		value:localStorage["source"]||""
	}
);

function updateSettings()
{
	code_editor.setOption("mode", settings.get("editor-highlighting")?"brainfuck":null);
	code_editor.setOption("keyMap",settings.get("editor-keymap").toLowerCase());
	code_editor.setOption("lineNumbers",settings.get("line-numbers"));
	debug.cell_width = 2**settings.get("cell-width");
	debug.optimize=settings.get("optimize");
	step_delay=settings.get("step-delay");

	/* New Theme */
	const editor_theme = settings.get("editor-theme");
	const global_theme = settings.get("global-theme");

	document.querySelector("#global-theme").href="themes/"+global_theme+".css";
	(a=>a.href=a.href.replace(/theme\/.*.css/, "theme/"+editor_theme+".css"))(
		document.querySelector("#editor-theme")
	);
	code_editor.setOption("theme",editor_theme);
}

/* For whatever reason, I decided to call states "Modes"
 * Kinda a FSM */
function switchToInputMode()
{
	last_state = mode;
	switchToDebugMode();
	mode = Mode.INPUT_MODE;
}
function switchFromInputMode()
{
	if(last_state === Mode.PLAY_MODE)
		play();
	else if(last_state === Mode.DEBUG_MODE)
		switchToDebugMode();
	else
		throw "Unknown mode we switched from";
}
function switchToPlayMode()
{
	switchToDebugMode();
	mode = Mode.PLAY_MODE;
	updateButtons();
}

function switchToEditMode()
{
	if(mode === Mode.EDIT_MODE)
		return;
	mode = Mode.TRANSITION_MODE;
	code_editor.setOption("readOnly", false);
	if(mark)mark.clear();
	mode = Mode.EDIT_MODE;
	updateButtons();
}

function switchToDebugMode()
{
	if([Mode.PLAY_MODE,Mode.DEBUG_MODE,Mode.INPUT_MODE].
		includes(mode))
	{
		mode = Mode.DEBUG_MODE;
		updateButtons();
		return;
	}
	mode = Mode.TRANSITION_MODE;

	loadAndReset();
	code_editor.setOption("readOnly", true);

	// Reset tape to beginning
	const tape_container = document.querySelector(".tape-container");
	tape_container.scrollLeft = 0;
	
	updateHighlight();

	mode = Mode.DEBUG_MODE;
	updateButtons();
}

function updateHighlight()
{
	const pc=debug.pc;
	const line = debug.tokens[pc].line;
	const column = debug.tokens[pc].column;

	if(line!==undefined && column!==undefined)
	{
		const anchor = {line:line, ch:column};
		const anchor2 = {line:anchor.line, ch:anchor.ch+1};

		if (mark) mark.clear();
		mark = code_editor.markText(anchor, anchor2, {
			className: "highlight",
			clearOnEnter: true
		});
		code_editor.scrollIntoView(anchor);
	}

}

function updateButtons()
{
	if(debug.atEnd())
	{
		document.querySelector("#playpause-button").disabled=true;
		document.querySelector("#step-forward-button").disabled=true;
	}
	else
	{
		document.querySelector("#playpause-button").disabled=false;
		document.querySelector("#step-forward-button").disabled=false;
	}

	if(debug.atBeginning())
	{
		document.querySelector("#step-back-button").disabled=true;
	}
	else
	{
		document.querySelector("#step-back-button").disabled=false;
	}

	if(mode === Mode.PLAY_MODE)
	{
		document.querySelector("#playpause-button").innerHTML=PAUSE_BUTTON_TEXT;
	}
	else
	{
		document.querySelector("#playpause-button").innerHTML=PLAY_BUTTON_TEXT;
	}
}

function loadAndReset()
{
	const source = code_editor.getValue();

	/* This causes debug to reset, as well*/
	try{
	debug.load(source);
	}catch(e){
		console.dir(e);
		raiseError(e);
		switchToEditMode();
		return;
	}
	localStorage["source"] = source;

	updateButtons();
	clearTape();
}

function clearTape()
{
	updateTape();
	for(let i=0;i<highest_cell;i++)
	{
		let cell = document.querySelector("#cell-"+i+" .cell-value").innerHTML=0;
	}
}

function updateTape()
{
	const pointer = debug.pointer;
	const desired_amount_of_cells = pointer>MIN_CELLS?pointer:MIN_CELLS;
	if(desired_amount_of_cells > highest_cell)
	{
		for(let i=highest_cell+1;i<=desired_amount_of_cells;i++)
		{
			const template = document.querySelector("#cell-template");
			const new_cell = template.cloneNode();
			new_cell.removeAttribute("style");
			new_cell.id="cell-"+i;
			new_cell.innerHTML = `<div class="cell-index">${i}</div><span class="cell-value">0</span>`;
			document.querySelector(".tape").appendChild(new_cell);
		}
		highest_cell = desired_amount_of_cells;
	}

	if(pointer !== undefined)
	{
		const val = debug.tape[pointer]||0;

		const current_cell = document.querySelector("#cell-"+pointer);
		const old_cell = document.querySelector(".cell.active");
		if(old_cell)
			old_cell.classList.remove("active");
		current_cell.querySelector(".cell-value").innerHTML=val;
		current_cell.classList.add("active");
	}
}
function step(reverse=false)
{
	try{
		debug.step(reverse);
	}catch(e)
	{
		raiseError(e);
		return;
	}
	updateHighlight();
	updateTape();
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function displayStacks()
{
	for(const token of debug.tokens)
	{
		if(token.character==='[')
		{
			console.log(token.pass_stack);
			console.log(token.in_progress);
		}
	}
}


document.querySelector("#step-forward-button").addEventListener("click",()=> {
	switchToDebugMode();
	if(!debug.atEnd())
	{
		step(false);
	}
	updateButtons();
});

function pause()
{
	document.querySelector("#playpause-button").removeEventListener("click",pause);
	document.querySelector("#playpause-button").addEventListener("click",play);
	switchToDebugMode();
}
async function play(){
	switchToPlayMode();
	document.querySelector("#playpause-button").removeEventListener("click",play);
	document.querySelector("#playpause-button").addEventListener("click",pause);
	while(!debug.atEnd() && mode === Mode.PLAY_MODE)
	{
		if(!step())break;;
		await sleep(step_delay);
	}
	updateButtons();
	if(mode === Mode.PLAY_MODE)
	{
		pause();
	}
}

document.querySelector("#step-back-button").addEventListener("click",()=> {
	switchToDebugMode();
	if(!debug.atBeginning())
	{
		step(true);
	}
	updateButtons();
});

document.querySelector("#playpause-button").addEventListener("click",play);

document.querySelector("#reset-button").addEventListener("click",()=> {
	switchToDebugMode();
	loadAndReset();
	updateHighlight();
});

document.querySelector("#edit-panel-container .CodeMirror").addEventListener("click",()=>{
	if(mode === Mode.DEBUG_MODE)
		switchToEditMode();
});

function addCharacterToTerminal(ch)
{
	const term = document.querySelector(".iobox");
	term.innerHTML+=ch;
	term.scrollTop = term.scrollHeight;

}
document.querySelector(".iobox").addEventListener("keydown", event=>{
	const key = event.key;
	console.log("input:"+key);
	if(event.isComposing ||
		event.keyCode === 229||
		mode !== Mode.INPUT_MODE
	)
	{
		return;
	}

	let character=key;

	if (key === "Tab")
		character="\t";
	else if (key === "Space")
		character=" ";
	else if (key === "Enter")
		character="\r";

	// ' and / open up search
	if("'/ ".includes(key))
		event.preventDefault();

	if(character.length === 1)
	{
		addCharacterToTerminal(character);
		input_queue.push(character.charCodeAt(0));
	}
	if(key==="Enter" && mode === Mode.INPUT_MODE)
		switchFromInputMode();
});

debug.output_callback=addCharacterToTerminal;

function raiseError(message)
{
	const modal = document.querySelector("#error-modal");
	modal.querySelector("#error-message").textContent = message;
	modal.removeAttribute("hidden");
}

function input_callback()
{
	// If val is null, Debugger does not step
	let val = null;
	if(input_queue.length > 0)
	{
		val = input_queue.shift();
		console.log("val: "+val);
	}
	else
	{
		switchToInputMode();
	}
	return val;
}
debug.input_callback = input_callback;

function closeModal()
{
	const modal = event.target.closest(".modal");
	modal.setAttribute("hidden",true);
	location.hash="";
}
document.querySelectorAll(".close-modal").forEach(target=>target.
	addEventListener("click",closeModal)
);
dom_elements.hamburger_button.addEventListener("click", ()=>{
	const menu = dom_elements.hamburger_menu;
	menu.toggleAttribute("hidden");
});
dom_elements.hamburger_menu.addEventListener("click", ()=> {
		dom_elements.hamburger_menu.setAttribute("hidden", true);
	});
document.querySelector("#open-settings").addEventListener("click",()=>{
	dom_elements.settings_modal.removeAttribute("hidden");
	location.hash="appearance-settings";
});

clearTape();
updateSettings();
