$(document).ready(function() {
	$("#input_ta").on("change keyup paste", function() {
		var input = $("#input_ta").val();
		console.log("input: " + input);
		$("#linted_ta").val(input.toUpperCase());
	});
});

