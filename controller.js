import {TokenType,Debugger} from "./Debugger.js";
import {accessLocalStorage, putLocalStorage, Settings} from "./Settings.js";

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
// Rows that we stop at
// Only in "Play" mode
const breakpoints = new Set();

const code_editor = CodeMirror(document.querySelector("#edit-panel-container"),
	{
		lineWrapping: true,
		spellCheck:false,
		value:accessLocalStorage("source")||"",
		gutters: ["breakpoints","CodeMirror-linenumbers"]
	}
);

function addBreakpoint(line)
{
	const marker = document.createElement("div");
	marker.classList.add("breakpoint");
	marker.innerHTML = "●";
	breakpoints.add(line);
	code_editor.setGutterMarker(line, "breakpoints", marker);
}
function removeBreakpoint(line)
{
	breakpoints.delete(line);
	code_editor.setGutterMarker(line, "breakpoints",null);
}
function clearBreakpoints()
{
	breakpoints.length=0;
	code_editor.clearGutter("breakpoints");
}
code_editor.on("gutterClick", function(cm, n) {
	const info = cm.lineInfo(n);
	if(!info.gutterMarkers)
		addBreakpoint(n);
	else
		removeBreakpoint(n)
});


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

	const iobox = document.querySelector("#iobox");
	iobox.focus();

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

	// Disable tape to show user that we're not debugging
	document.getElementById("tape").classList.add("disabled");

	// Reset debugger - this is mainly to stop cell highlighting
	debug.load("");

	// Disable CodeMirror input
	code_editor.setOption("readOnly", false);

	// Remove highlighting
	if(mark)mark.clear();

	mode = Mode.EDIT_MODE;

	updateButtons();
	updateTape();
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
	document.getElementById("tape").classList.remove("disabled");
	code_editor.setOption("readOnly", true);

	// Restore breakpoints
	breakpoints.length=0;
	for(let i=0;i<code_editor.lineCount();i++)
	{
		const info = code_editor.lineInfo(i);
		if(info.gutterMarkers)
			addBreakpoint(i);
	}

	// Reset tape to beginning
	const tape_container = document.getElementById("tape-container");
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
	else if(mark)
		mark.clear();

}

function updateButtons()
{
	const playpause_button = document.getElementById("playpause-button");
	const step_forward_button = document.getElementById("step-forward-button");
	const step_back_button = document.getElementById("step-back-button");

	if(debug.atEnd())
	{
		playpause_button.disabled=true;
		step_forward_button.disabled=true;
	}
	else
	{
		playpause_button.disabled=false;
		step_forward_button.disabled=false;
	}

	if(debug.atBeginning())
	{
		step_back_button.disabled=true;
	}
	else
	{
		step_back_button.disabled=false;
	}

	if(mode === Mode.PLAY_MODE)
	{
		playpause_button.innerHTML=PAUSE_BUTTON_TEXT;
	}
	else
	{
		playpause_button.innerHTML=PLAY_BUTTON_TEXT;
	}
}

function loadAndReset()
{
	const source = code_editor.getValue();
	input_queue.length=0;

	/* This causes debug to reset, as well*/
	try{
		debug.load(source);
	}catch(e){
		console.dir(e);
		raiseError(e);
		switchToEditMode();
		return;
	}
	putLocalStorage("source", source);
	updateButtons();
	clearTape();
}

function clearTape()
{
	updateTape();

	const tape = document.getElementById("tape");
	for(let i=0;i<highest_cell;i++)
	{
		const cell = tape.querySelector("#cell-"+i)
		cell.querySelector(".cell-value").innerHTML="0";
	}
}

function updateTape()
{
	const tape = document.getElementById("tape");
	const pointer = debug.pointer;
	const desired_amount_of_cells = pointer>MIN_CELLS?pointer:MIN_CELLS;

	if(desired_amount_of_cells > highest_cell)
	{
		const template = tape.querySelector("#cell-template");
		for(let i=highest_cell+1;i<=desired_amount_of_cells;i++)
		{
			const new_cell = template.cloneNode(true);
			new_cell.removeAttribute("hidden");
			new_cell.id="cell-"+i;
			new_cell.querySelector(".cell-index").textContent=i;
			new_cell.querySelector(".cell-value").textContent="0";
			tape.appendChild(new_cell);
		}
		highest_cell = desired_amount_of_cells;
	}

	const old_cell = tape.querySelector(".active");
	if(old_cell)
	{
		old_cell.classList.remove("active");
	}
	if(!debug.atBeginning())
	{
		const val = debug.tape[pointer]||0;
		const current_cell = tape.querySelector("#cell-"+pointer||0);

		current_cell.querySelector(".cell-value").textContent=val;
		current_cell.classList.add("active");
	}
}
function step(reverse=false, update=true)
{
	try{
		debug.step(reverse);
	}catch(e)
	{
		raiseError(e);
		return false;
	}
	if(update)
	{
		updateHighlight();
		updateTape();
	}
	return true;
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
	let counter=0;
	while(!debug.atEnd() && mode === Mode.PLAY_MODE)
	{
		/*
		 * step_delay === 0 is super speed mode
		 * Only stopping occasionally
		 * or for input or output
		 */
		let token = debug.tokens[debug.pc];
		const prev_line = token.line;
		if(
			step_delay>0||
			((counter%1000)===0) ||
			[
				TokenType.BF_OUTPUT,
				TokenType.BF_INPUT,
				TokenType.BF_START,
				TokenType.BF_END
			].includes(token.type)
		)
		{
			if(!step())break;
			await sleep(step_delay?step_delay-1:0);
		}
		else
		{
			if(!step(false, false))break;
		}
		counter++;

		token = debug.tokens[debug.pc];
		if(breakpoints.has(token.line) && token.line !== prev_line)
		{
			break;
		}
	}
	updateTape();
	updateButtons();
	updateHighlight();
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

document.querySelector("#edit-panel-container .CodeMirror-lines").addEventListener("click",()=>{
	if(mode === Mode.DEBUG_MODE)
		switchToEditMode();
});

function addCharacterToIOBox(ch)
{
	const term = document.querySelector("#iobox");
	if(ch==='\r')
	{
		ch='\n\r';
	}
	term.querySelector("#iobox-content").textContent+=ch;
	term.scrollTop = term.scrollHeight;
}

document.querySelector("#iobox").addEventListener("focus", event=>{
	iobox.querySelector("#iobox-cursor").removeAttribute("hidden");
});
document.querySelector("#iobox").addEventListener("blur", event=>{
	iobox.querySelector("#iobox-cursor").hidden = true;
});

document.querySelector("#iobox").addEventListener("keydown", event=>{
	const key = event.key;
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
		addCharacterToIOBox(character);
		input_queue.push(character.charCodeAt(0));
	}
	if(key==="Enter" && mode === Mode.INPUT_MODE)
		switchFromInputMode();
});

debug.output_callback=addCharacterToIOBox;

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
document.getElementById("open-settings").addEventListener("click",()=>{
	dom_elements.settings_modal.removeAttribute("hidden");
	location.hash="appearance-settings";
});
document.getElementById("clear-iobox").addEventListener("click",()=>{
	document.getElementById("iobox-content").textContent="";
	input_queue.length=0;
});
document.getElementById("clear-breakpoints").
	addEventListener("click", clearBreakpoints())

clearTape();
updateSettings();
updateButtons();
