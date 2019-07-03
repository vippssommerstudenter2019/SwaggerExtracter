# Swagger extracter

Extracts information from a swagger file and generates code examples.

## Installation

Navigate to swagger-extracter:

`npm install`

`npm link .`

Navigate to your package:

`npm link swagger-extracter`


## Use

The data from the swagger extracter is a map of a range of information and code examples from the swagger file.

```javascript
const SwaggerExtracter = require("swagger-extracter");

SwaggerExtracter.retrieveDataFromSwaggerFileAtUrl(url, (data, error) => {
   // Do something with the data. 
});
```





 