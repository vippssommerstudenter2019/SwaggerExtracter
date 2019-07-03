const yaml = require("js-yaml");
const converter = require("widdershins");
const fetch = require("node-fetch");
const path = require("path");
/**
 * Generates the markdown string based in the templates for the given swagger file.
 * 
 * @param {*} string The swagger file represented as a string.
 * @param {*} callback Fires when the generation is done with an error and the string (if any).
 */
function generateMarkdownStringFromSwagger(string, callback) {
    
    // Widdershin options
    let options = {};
    options.codeSamples = true;
    options.httpsnippet = false;
    options.theme = "darkula";
    options.search = false;
    options.discovery = false;
    options.shallowSchemas = false;
    options.tocSummary = false;
    options.headings = 2;
    options.verbose = false;
    options.omitBody = false;
    options.language_tabs = [{ 'shell': 'Shell' }, { 'http': 'HTTP' }, { 'javascript': 'JavaScript' }, { 'javascript--nodejs': 'Node.JS' }, { 'ruby': 'Ruby' }, { 'python': 'Python' }, { 'java': 'Java' }, { 'go': 'Go' }];
    options.sample = true;
    options.user_templates = path.join(__dirname, 'templates', 'openapi3');

    // Load the api in the fila path
    let api = yaml.safeLoad(string, { json: true });

    // Convert to the template specified in the templates directory
    converter.convert(api, options, (error, markdownString) => {
        callback(error, markdownString);
    });
}

/**
 * Generates a map of example code for various languages provided from the source.
 * 
 * @param {*} source The input text.
 */
function extractExampleCodeForLanguagesSource(source) {
    let lines = source.split('\n');
    var exampleCodeMap = {};

    var inScope = false;
    var currentLanguage;
    var currentCode;

    let indicator = "```";

    for (var line of lines) {

        // We find the block of code
        if (line.startsWith(indicator)) {

            if (!inScope) {
                inScope = true;
                currentCode = "";
                currentLanguage = line.replace(indicator, "").trim();
            }
            else {
                inScope = false;
                exampleCodeMap[currentLanguage] = currentCode.trim();
            }
        }

        // Grab the source code
        if (inScope && !line.startsWith(indicator)) {
            currentCode += (line + "\n");
        }
    }

    return exampleCodeMap;
}

/**
 * Returns a JSON object encoding the body component.
 * 
 * @param {*} source The source text.
 */
function extractBodyFromSource(source) {

    let lines = source.split('\n');
    var body = {};
   
    let endpointInfo = lines[0].trim().split("|");

    var endpoint = {
        "type" : endpointInfo[0], 
        "url" : endpointInfo[1]};
    body["endpoint"] = endpoint; 

    var inScope = false;
    var data;
    var dataFormat;

    let indicator = "```";

    for (var line of lines) {

        // We find the block of code
        if (line.startsWith(indicator)) {

            if (!inScope) {
                inScope = true;
                data = "";
                dataFormat = line.replace(indicator, "").trim();
            }
            else {
                inScope = false;
                body[dataFormat] = JSON.parse(data);
            }
        }

        // Grab the source code
        if (inScope && !line.startsWith(indicator)) {
            data += (line + "\n");
        }
    }


    return body;
}

/**
 * Extracts the parameters from the source.
 * 
 * @param {*} source The source text.
 */
function extractParametersFromSource(source) {

    var lines = source.split("\n").filter((el) => { return el !== ""; });

    var parameters = {};

    for (var line of lines) {
        let items = line.split("|").filter((item) => { return item !== "" });

        var parameter = {};
        parameter["in"]             = items[1];
        parameter["type"]           = items[2];
        parameter["required"]       = items[3];
        parameter["description"]    = items[4]; 

        parameters[items[0]] = parameter;
    }
    

    return parameters;
}

/**
 * Extracts the responses from the source.
 *
 * @param {*} source The source text.
 */
function extractResponsesFromSource(source) {
    var lines = source.split("\n").filter((el) => { return el !== ""; });

    var responses = {};
    var inScope = false;
    var currentData;
    var currentStatusCode = "";

    let indicator = "```";

    for (var line of lines) {

        if (line.startsWith(">")) {
            currentStatusCode = line.split(" ")[1];

            responses[currentStatusCode] = {};
        }

        if (line.startsWith(indicator)) {
            if (!inScope) {
                inScope = true;
                currentData = "";
            }
            else {
                inScope = false;
                responses[currentStatusCode] = {};
                responses[currentStatusCode]["example"] = JSON.parse(currentData);
            }
        }

        if (inScope && !line.startsWith(indicator)) {
            currentData += (line + "\n");
        }

        if (line.startsWith("%")) {
            line = line.replace("%", "");

            let items = line.split("|").filter((item) => { return item !== "" });

            if (!responses[items[0]]) {
                responses[items[0]] = {};
            }

            responses[items[0]]["meaning"] = items[1];
            responses[items[0]]["schema"] = items[2];
            responses[items[0]]["description"] = items[3];
        }
    }

    return responses; 
}

/**
 * Callbacks for how to process the data for the different components.
 */
let functionMap = {
    "name" : ((input) => { return input; }),
    "code" : extractExampleCodeForLanguagesSource,
    "body": extractBodyFromSource, 
    "parameters": extractParametersFromSource,
    "responses": extractResponsesFromSource,
    "callbacks": ((input) => { return input.trim(); }),
    "auth": ((input) => { return input.trim(); })
}

/**
 * Extracts data from the markdown string generated from the templates.
 * 
 * @param {*} input The markdown string.
 */
function convertMarkdownStringToData(input) {

    var endpointData = input.trim().split("####");
    endpointData = endpointData.slice(1, endpointData.length);

    var data = {};

    for (var endpoint of endpointData) {

        var endpointName = "";

        endpoint = endpoint.split("\n");

        var inScope = false;
        var currentComponent;
        var currentComponentData;
        let indicator = "$$$";

        // Traverse through the input and get the components for this endpoint
        for (var line of endpoint) {

            // We find the block for the component
            if (line.startsWith(indicator)) {

                // We have encountered a new block for a component, we start capturing the data
                if (!inScope) {
                    inScope = true;
                    currentComponentData = "";
                    currentComponent = line.replace(indicator, "").trim();
                }
                else {
                    // We found the end for the data of the current component
                    inScope = false;

                    if (currentComponent === "") {
                        continue;
                    }

                    if (currentComponent === "name") {
                        endpointName = currentComponentData.trim();
                        data[endpointName] = {};
                    }
                    else {
                        data[endpointName][currentComponent] = functionMap[currentComponent](currentComponentData);
                    }
                }

            }

            // We check if we're in the scope or not and add every line as long as we are.
            if (inScope && !line.startsWith(indicator)) {
                currentComponentData += (line + "\n");
            }
        }
    }

    return data;
}

/**
 * Retrives a swagger file from an URL calls a callback with the data when loaded and parsed.
 * 
 * @param {*} url The url to the swagger file.
 * @param {*} callback Called when the parsing is done, consist of the data and an error (if any).
 */
exports.retrieveDataFromSwaggerFileAtUrl = function(url, callback) {

    fetch(url) 
        .then((response) => {
            response.text().then((data) => {
                generateMarkdownStringFromSwagger(data, (error, markdownString) => {
                    callback(convertMarkdownStringToData(markdownString), error)
                });
            });
        })
        .catch(function (error) {
            callback(null, error);  
        });
}