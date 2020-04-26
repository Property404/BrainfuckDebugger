import Debugger from "./Debugger.js";

const Mode = Object.freeze({
	"EDIT_MODE":1,
	"TRANSITION_MODE":2,
	"RUN_MODE":3});

let debug = new Debugger();
let mode = Mode.EDIT_MODE;



function switchToEditMode()
{
	mode = Mode.TRANSITION_MODE;
	document.querySelector(".editor textarea").style.display = "block";
	document.querySelector(".editor .debug-view").style.display = "none";
	mode = Mode.TRANSITION_MODE;
}

function switchToRunMode()
{
	mode = Mode.TRANSITION_MODE;
	loadAndReset();
	let textarea = document.querySelector(".editor textarea");
	let debug_view = document.querySelector(".editor .debug-view");

	textarea.style.display = "none";
	debug_view.style.display = "block";

	debug_view.innerHTML = textarea.textContent;

	updateHighlight();

	mode = Mode.RUN_MODE;
}

function updateHighlight()
{
	let debug_view = document.querySelector(".editor .debug-view");
	const pos=debug.getPositionInSource();
	const prechunk = debug.source.substring(0,pos);
	const postchunk = debug.source.substring(pos+1);

	let highlighted_char = document.createElement("span");
	highlighted_char.classList.add("highlight");
	highlighted_char.innerHTML=debug.source.charAt(pos);
	

	debug_view.innerHTML=prechunk;
	debug_view.appendChild(highlighted_char);
	debug_view.innerHTML+=postchunk;
}

function loadAndReset()
{
	let textarea = document.querySelector(".editor textarea");
	const source = textarea.textContent;
	/* This causes debug to reset, as well*/
	debug.load(source);
}

function step(reverse=false)
{
	debug.step(reverse);
	updateHighlight();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

switchToRunMode();

document.querySelector("#step-forward-button").addEventListener("click",()=> {
	step(false);
});

document.querySelector("#step-back-button").addEventListener("click",()=> {
	step(true);
});

document.querySelector("#reset-button").addEventListener("click",()=> {
	loadAndReset();
	updateHighlight();
});

