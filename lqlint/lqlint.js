var sample = 'json "[{\\"_node\\"=\\"node1\\", \\"count\\"=0}, {\\"_node\\"=\\"node2\\", \\"count\\"=0}, {\\"_node\\"=\\"node3\\", \\"count\\"=0}]" | fulltext [ table duration=1d blacklist ] or [ table duration=1d whitelist ] from firewall | join type=left _node [ table duration=1m *:sys_cpu_logs | stats max(_time) as _time, count by _node ] | search count == 0 | rename _node as node, count as ecount | eval etime = now(), etime_start = now(), etime_end = now(), etime_week = string(now(), "E") | eval device_name = case(node == "local", "local_쿼리마스터", node == "node1", "LOGPRESSO(node1_본청)", node == "node2", "LOGPRESSO(node2_자치구)", node == "node3", "LOGPRESSO(node3_산하기관)", node) | eval \ncategory = "LOGPRESSO", dept_b = "서울사이버안전센터" | join type=left dept_b [ table *:scsc_lkup_table | stats count by category_a, category_b, dept_code | fields - count | rename category_a as dept_a, category_b as dept_b ] | eval device_ip = case(device_name == "*local*", "99.110.100.232", device_name == "*node1*", "98.110.100.223", device_name == "*node2*", "98.110.100.226", device_name == "*node3*", "98.110.100.229", device_name) | eval source = "sys_cpu_logs", src_ip = device_ip, dst_ip = device_ip, src_ip_country = "KR", dst_ip_country = "KR", protocol = "TCP", action = "응답없음", ecount = 1 | eval rule_id = "910000" | eval rule_name = concat("로그프레소 응답오류 / ", device_name), signature = rule_name | eval rule_type = "시스템" | eval rule_risk = "HIGH" | eval key = concat(rule_id,string(now(),"yyyyMMddHHmmss"), format("%010d",seq())) | import SCSC_ISC_RULE | import SCSC_ISC_RULE_RAW';

var INDENT_SIZE = 4;

function hasSubQuery(command) {
	var result = false;
	var quote = null;
	var prev = ' ';
	for (var i = 0; i < command.length; ++i) {
		var ch = command[i];
		if (prev == '\\' && quote != null) {
			prev = ch;
			continue;
		} 
		if ((ch == '\"' || ch == '[') && quote == null) { // quote start
			if (ch == '[')
				result = true;
			quote = ch;
			prev = ch;
			continue;
		} 
		if ((ch == '\"' || ch == ']') && quote != null) { // possibly quote end
			if ((quote == '\"' && ch == '\"') || // match ch with quote opening
				(quote == '[' && ch == ']')) {
				quote = null;
				prev = ch;
			}
			continue;
		}
	}
	// check invalid quotation or parentheses
	return result && quote == null;
}

function lintCommandWithSubQuery(indent, command) {
	var sqlist = [];
	var ext = "";
	var sqpositions = [];
	var quote = null;
	var sq = null;
	var prev = ' ';
	for (var i = 0; i < command.length; ++i) {
		var ch = command[i];
		if (prev == '\\' && quote != null) {
			if (sq != null) sq += ch; else ext += ch;
			prev = ch;
			continue;
		} 
		if ((ch == '\"' || ch == '[') && quote == null) { // quote start
			if (sq != null) sq += ch; else ext += ch;
			if (ch == '[') {
				sq = ""; // init to grab subquery
				sqpositions.push(ext.length);
			}
			quote = ch;
			prev = ch;
			continue;
		} 
		if ((ch == '\"' || ch == ']') && quote != null) { // possibly quote end
			if ((quote == '\"' && ch == '\"') || // match ch with quote opening
				(quote == '[' && ch == ']')) {
				// dispose subquery
				if (ch == ']' && sq != null) {
					sqlist.push(sq.trim());
					sq = null;
				}
				quote = null;
				prev = ch;
			}
			if (sq != null) sq += ch; else ext += ch;
			continue;
		}
		if (sq != null) sq += ch; else ext += ch;
		prev = ch;
	}
	console.log(command);
	console.log(ext);
	console.log(sqpositions);
	console.log(sqlist);
	var result = "";
	var prepos = 0;
	for (var i = 0; i < sqpositions.length; ++i) {
		if (i != 0)
			result += "\n" + makeIndentStr(indent+INDENT_SIZE);
		result += ext.substring(prepos, sqpositions[i] - 1).replace(/^\s+/, "") + "\n" + makeIndentStr(indent+INDENT_SIZE) + "[ ";
		result += lqlint(indent + INDENT_SIZE, sqlist[i]) + " ]"
		
		prepos = sqpositions[i] + 1;
	}
	if (ext.substring(prepos).trim().length != 0) {
		result += "\n" + makeIndentStr(indent+INDENT_SIZE);
		result += ext.substring(prepos).replace(/^\s+/, "");
	}
	return result;
}

function lqlint(indent, input) {
	console.log("input2: " + input);
	// join all lines
	input = input.split("\n").join("");
	// split command by command (considering subquery)
	var commands = []
	var cmd = "";
	var quote = null;
	var prev = ' ';
	for (var i = 0; i < input.length; ++i) {
		var ch = input[i];
		if (prev == '\\' && quote != null) {
			cmd += ch;
			prev = ch;
			continue;
		} 
		if ((ch == '\"' || ch == '[') && quote == null) { // quote start
			quote = ch;
			cmd += ch;
			prev = ch;
			continue;
		} 
		if ((ch == '\"' || ch == ']') && quote != null) { // possibly quote end
			cmd += ch;
			if ((quote == '\"' && ch == '\"') || // match ch with quote opening
				(quote == '[' && ch == ']')) {
				quote = null;
				prev = ch;
			}
			continue;
		}
		if (ch == '|' && quote == null) {
			commands.push(cmd)
			cmd = "";
		} else {
			cmd += ch;
		}
		prev = ch;
	}
	commands.push(cmd);
	
	// state validation
	if (quote != null)
		throw "illegal input: quote not matched("+quote+")"

	// left trim && lint commands recursively
	var indentStr = makeIndentStr(indent);
	for (var i = 0; i < commands.length; ++i) {
		commands[i] = commands[i].replace(/^\s+/, "");
		if (hasSubQuery(commands[i])) {
			commands[i] = lintCommandWithSubQuery(indent, commands[i])
		}
	}
	// add newline at startings of subquery
	// indent and lint subqueries recursively
	return commands.join("\n" + indentStr + "| ");
}

function makeIndentStr(indent) {
	// XXX: can be faster
	var result = "";
	for (var i = 0; i < indent; ++i) {
		result += ' ';
	}
	return result;
}

$(document).ready(function() {
	$("#input_ta").on("change keyup paste", function() {
		var input = $("#input_ta").val();
		$("#linted_ta").val(lqlint(0, input));
	});
	$("#input_ta").val(sample);
	$("#input_ta").trigger("change");
});

