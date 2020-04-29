import Debugger from './Debugger.js'
function assert(claim, message, object)
{
	if (message == undefined)
		message = "<no message>";
	if(!claim)
	{
		console.log("--ASSERTION FAILED--");
		if(object)
			object.displayTape();
		throw "Assertion failed:" + message;
	}
}
function test(func)
{
	if(func())
		console.log(func.name + " PASSED");
	else
		console.log(func.name + " FAILED");
}
function codifyString(str)
{
	let output="";
	for(let c of str)
	{
		if(c.charCodeAt(0) < 33)
		{
			output+="<"+c.charCodeAt(0)+">";
		}
		else
		{
			output+=c;
		}
	}
	return output;

}
const SOURCES = [
	{
		code:"------- [+] +++",
		expected_result:""
	},
	{
		code:"+++++[-]+++",
		expected_result:""
	},
	{
		code:"+++[->++<]>>--->>++",
		expected_result:""
	},
	{
		code:"++++++++[->-[->-[->-[-]<]<]<] ++++++++[<++++++++++>-]<[>+>+<<-]>-.>-----.>++++++++++.",
		expected_result:"OK\n"
	},
	{
		code:" >++++++++[-<+++++++++>]<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]>-----.>-> +++..+++.>-.<<+[>[+>+]>>]<--------------.>>.+++.------.--------.>+.>+.",
		expected_result:"Hello World!\n"
	}
];

function congruent_state_test(){
	for(let source of SOURCES)
	{
		let debug = new Debugger(source.code);

		let output = "";
		debug.output_callback = (val)=>{output+=val;}

		while(!debug.atEnd())
		{
			debug.step();
		}

		assert(output==source.expected_result);


		const first_final_hash = debug.getStateHash();
		debug.reset();

		for(let i=0;!debug.atEnd();i++)
		{
			const hash1=debug.getStateHash();
			debug.step();

			const hash2=debug.getStateHash();
			debug.step(true);

			const hash3=debug.getStateHash();
			debug.step();

			const hash4=debug.getStateHash();

			assert(hash1===hash3, "hash1!==hash3", debug);
			assert(hash2===hash4, "hash2!==hash4", debug);
		}

		assert(debug.getStateHash()===first_final_hash, "Final hash failed");
	}
	return true;
};

function rewind_test(){
	let debug=new Debugger();
	for(let source of SOURCES)
	{
		let output="";
		debug.load(source.code);

		assert(debug.source === source.code);
		assert(debug.pc === 0);
		assert(debug.pointer === 0);

		debug.output_callback = (val)=>{ output+=val; }

		let initial_hash = debug.getStateHash();

		while(!debug.atEnd())
		{
			debug.step();
		}

		let final_hash = debug.getStateHash();

		assert(output === source.expected_result, "Before rewind: expected output not matched");


		/* Rewind */
		while(!debug.atBeginning())
		{
			debug.step(true);
		}

		assert(debug.getStateHash() == initial_hash, "Initial hash is not the same");

		output="";
		while(!debug.atEnd())
		{
			debug.step();
		}

		assert(output === source.expected_result, "After rewind: expected output not matched");
	}
	return true;
}

function pinpoint_test(){
	let code = ">++<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]";
	code = ">>>>>>+>+>+[[->+<]<]";
	let debug=new Debugger(code);

	let i=0;
	let initial_hash = debug.getStateHash();
	while(!debug.atEnd())
	{
		debug.step();
		i++;
		let pc = debug.pc;
		for(let j=0;j<i;j++)
		{
			debug.step(true);
		}
		assert(debug.getStateHash() === initial_hash, "i: "+i+" pc:"+pc);
		for(let j=0;j<i;j++)
		{
			debug.step();
		}
	}
	return true;
}


test(congruent_state_test);
test(rewind_test);
test(pinpoint_test);
