var sample = 'json "[{"_node"="node1", "count"=0}, {"_node"="node2", "count"=0}, {"_node"="node3", "count"=0}]" | join type=left _node [ table duration=1m *:sys_cpu_logs | stats max(_time) as _time, count by _node ] | search count == 0 | rename _node as node, count as ecount | eval etime = now(), etime_start = now(), etime_end = now(), etime_week = string(now(), "E") | eval device_name = case(node == "local", "local_쿼리마스터", node == "node1", "LOGPRESSO(node1_본청)", node == "node2", "LOGPRESSO(node2_자치구)", node == "node3", "LOGPRESSO(node3_산하기관)", node) | eval category = "LOGPRESSO", dept_b = "서울사이버안전센터" | join type=left dept_b [ table *:scsc_lkup_table | stats count by category_a, category_b, dept_code | fields - count | rename category_a as dept_a, category_b as dept_b ] | eval device_ip = case(device_name == "*local*", "98.110.100.232", device_name == "*node1*", "98.110.100.223", device_name == "*node2*", "98.110.100.226", device_name == "*node3*", "98.110.100.229", device_name) | eval source = "sys_cpu_logs", src_ip = device_ip, dst_ip = device_ip, src_ip_country = "KR", dst_ip_country = "KR", protocol = "TCP", action = "응답없음", ecount = 1 | eval rule_id = "910000" | eval rule_name = concat("로그프레소 응답오류 / ", device_name), signature = rule_name | eval rule_type = "시스템" | eval rule_risk = "HIGH" | eval key = concat(rule_id,string(now(),"yyyyMMddHHmmss"), format("%010d",seq())) | import SCSC_ISC_RULE | import SCSC_ISC_RULE_RAW';

function lqlint(input) {
	console.log("input2: " + input);
	return input.toUpperCase();
}

$(document).ready(function() {
	$("#input_ta").on("change keyup paste", function() {
		var input = $("#input_ta").val();
		$("#linted_ta").val(lqlint(input));
	});
	$("#input_ta").val(sample);
	$("#input_ta").trigger("change");
});

