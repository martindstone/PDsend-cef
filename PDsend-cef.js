var example = {
    "payload": {
  },
  "event_action": "trigger",
};

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function saveFormValues(name) {
	
	if ( ! name ) {
		return;
	}
	var savedList = [];
	var savedListStr = localStorage.getItem("saved");
	if ( savedListStr ) {
		savedList = JSON.parse(savedListStr);
	}

	var values = {};
	$('#event-form :input').each(function() {		
		if ( $(this).attr('type') == "text" || $(this).is('select') ) {
			var k = $(this).attr('id');
			var v = $(this).val();
			values[k] = v;
		}
	});

	localStorage.setItem(name, JSON.stringify(values));
	if ( savedList.indexOf(name) == -1 ) {
		savedList.push(name);
		localStorage.setItem("saved", JSON.stringify(savedList));
	}
	populateSaved();
}

function deleteSavedFormValues(name) {
	var savedListStr = localStorage.getItem("saved");
	if ( ! savedListStr ) {
		return;
	}
	savedList = JSON.parse(savedListStr);
	if ( savedList.indexOf(name) > -1 ) {
		localStorage.removeItem(name);
		savedList.splice(savedList.indexOf(name), 1);
		localStorage.setItem("saved", JSON.stringify(savedList));
		populateSaved();
	}


}

function loadFormValues(name) {
	values = JSON.parse(localStorage.getItem(name));
	Object.keys(values).forEach(function(key) {
		$('#event-form :input[id="' + key + '"]').val(values[key]);
	});
	$('.selectpicker').selectpicker('refresh');

}


function populateSaved() {
	$('#saved').html('');
	var savedListStr = localStorage.getItem("saved");
	if ( ! savedListStr ) {
		savedListStr = JSON.stringify(["Example Event"]);
		var exampleStr = "{\"payload.summary\":\"Example Summary\",\"payload.severity\":\"critical\",\"payload.source\":\"aws:elasticache:us-east-1:852559987:cluster/api-stats-prod-003\",\"payload.location\":\"Datacenter 7\",\"payload.component\":\"mysql\",\"payload.group\":\"prod-datapipe\",\"payload.class\":\"deploy\",\"client\":\"Sample Monitoring Service\",\"client_url\":\"https://monitoring.service.com\",\"links.text\":\"This is a sample link\",\"links.href\":\"http://acme.pagerduty.com\",\"images.src\":\"https://chart.googleapis.com/chart?chs=600x400&chd=t:6,2,9,5,2,5,7,4,8,2,1&cht=lc&chds=a&chxt=y&chm=D,0033FF,0,0,5,1\"}"
		localStorage.setItem("Example Event", exampleStr);
		localStorage.setItem("saved", savedListStr);
	}
	savedList = JSON.parse(savedListStr);

	$('#saved').html('<h1>Saved:</h1><table class="table">');
	savedList.forEach(function(saved) {
		$('#saved').append('<tr><td width="60%">' + saved + '</td><td style="align: right"><button class="btn btn-primary load-button" load-target="' + saved + '">Load</button>'
			+ '<button class="btn btn-danger delete-button" delete-target="' + saved + '">X</button></td></tr>');
	});
	$('#saved').append('</table>');
	$('.load-button').click(function() {
		var target = $(this).attr('load-target');
		loadFormValues(target);
	});
	$('.delete-button').click(function() {
		var target = $(this).attr('delete-target');
		deleteSavedFormValues(target);
	});
}

function PDRequest(token, endpoint, method, options) {

	var merged = $.extend(true, {}, {
		type: method,
		dataType: "json",
		url: "https://api.pagerduty.com/" + endpoint,
		headers: {
			"Authorization": "Token token=" + token,
			"Accept": "application/vnd.pagerduty+json;version=2"
		},
		error: function(err) {
			$('.busy').hide();
			var alertStr = "Error '" + err.status + " - " + err.statusText + "' while attempting " + method + " request to '" + endpoint + "'";
			try {
				alertStr += ": " + err.responseJSON.error.message;
			} catch (e) {
				alertStr += ".";
			}
			
			try {
				alertStr += "\n\n" + err.responseJSON.error.errors.join("\n");
			} catch (e) {}

			alert(alertStr);
		}
	},
	options);

	$.ajax(merged);
}

function PDCEFEvent(options) {
	var merged = $.extend(true, {}, {
		type: "POST",
		dataType: "json",
		headers: {
			"Accept": "application/vnd.pagerduty+json;version=2.0"
		},
		url: "https://events.pagerduty.com/v2/enqueue"

	},
	options);
	
	$.ajax(merged);
}

function populateTriggerSelect() {
	var token = getParameterByName("token");
	var servicesData;
	var integrationIDs = [];
	async.series([
		function(callback) {
			var options = {
				success: function(data) {
					servicesData = data;
					callback(null, "yay");
				}
			};
			PDRequest(token, "services", "GET", options);
		},
		function(callback) {
			servicesData.services.forEach(function(service) {
				service.integrations.forEach(function(integration) {
					if ( integration.type.includes("generic_events_api_inbound") || integration.type.includes("nagios_inbound") ) {
						integrationIDs.push([service.id, integration.id]);
					}
				});
			});
			callback(null, "yay");
		},
		function(callback) {
			var infoFns = [];
			integrationIDs.forEach(function(integrationID) {
				infoFns.push(function(callback) {
					var options = {
						success: function(integrationInfo) {
							callback(null, integrationInfo);
						}
					}
					PDRequest(token, "services/" + integrationID[0] + "/integrations/" + integrationID[1], "GET", options);
				});
			});
			async.parallel(infoFns, 
				function(err, results) {
					results.forEach(function(result) {
						$('#trigger-dest-select').append($('<option/>', {
							value: result.integration.integration_key,
							text: result.integration.service.summary + ": " + result.integration.name
						}));
					});
					$('#trigger-dest-select').selectpicker('refresh');
					$('.busy').hide();
			});
		}
	]);
}

function removeEmpty(obj) {
	Object.keys(obj).forEach(function(key) {
		if (obj[key] && typeof obj[key] === 'object') {
			removeEmpty(obj[key]);
		}
		else if (obj[key] == null || obj[key] == '') {
			delete obj[key];
		}
	});
}

function main() {
	$('.selectpicker').selectpicker();
	populateTriggerSelect();
	populateSaved();

	
	$('#trigger-send-button').click(function() {

		$('#result').html('');

		var formValues = $('#event-form').serializeObject();

		var merged = $.extend(true, {
			routing_key: $('#trigger-dest-select').val(),
			timestamp: (new Date()).toISOString()
		}, 
		example, formValues);
		removeEmpty(merged);

		// get rid of empty values in links and images
		if ( merged.links && merged.links.length === 1 && Object.keys(merged.links[0]).length === 0 ) {
			delete merged.links;
		}
		if ( merged.images && merged.images.length === 1 && Object.keys(merged.images[0]).length === 0 ) {
			delete merged.images;
		}

		var n = parseInt($('#times').val());

		async.times(n, function(n, next) {
			$('#result').append('Sending event number ' + n + '<br>\n');
			var options = {
				data: JSON.stringify(merged),
				success: function(data) {
					$('#result').append('Event number ' + n + ' success: ' + JSON.stringify(data) + "<br>");
					next(null, 'yay');
				},
				error: function(err) {
					$('#result').append('Event number ' + n + ' failure: ' + JSON.stringify(err) + "<br>");
					next(err);
				}
			};
			PDCEFEvent(options);
		},
		function(err, data) {
			$('#result').append('All done!<br>');
		});
	});

	$('#save-button').click(function() {
		saveFormValues($('#save-name').val());
	});

	$('#load-button').click(function() {
		loadFormValues($('#save-name').val());
	});
}


$(document).ready(main);
