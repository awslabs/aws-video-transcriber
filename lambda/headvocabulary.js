
var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var transcribe = new AWS.TranscribeService();

/**
 * Checks if vocabulary can currently be updated
 */
exports.handler = async (event, context, callback) => {

    console.log('[INFO] Event: %j', event);

    try
    {
		var canUpdate = true;

        var vocabularyName = process.env.VOCABULARY_NAME;

        var listVocabularyParams = {
            NameContains: vocabularyName
        };

        console.log('[INFO] listing vocabularies using params: %j', listVocabularyParams);

        var listVocabularyResponse = await transcribe.listVocabularies(listVocabularyParams).promise();

        console.log('[INFO] got list vocabulary response: %j', listVocabularyResponse);

        if (listVocabularyResponse.Vocabularies && listVocabularyResponse.Vocabularies[0])
        {
            var status = listVocabularyResponse.Vocabularies[0].VocabularyState;

            console.log('[INFO] found vocabulary status: ' + status);

            if (status == 'PENDING')
            {
                console.log('[INFO] vocabulary cannot be updated now');
                canUpdate = false;
            }
            else
            {
            	console.log('[INFO] vocabulary can be updated now');
            }
        }
        else
        {
            console.log('[INFO] no existing vocabulary, vocabulary can be updated now');
            canUpdate = true;
        }

	    var responseHeaders = {
	        'Access-Control-Allow-Origin': '*',
	        'Access-Control-Allow-Credentials': true
	    }; 
	    
        const response = {
            statusCode: canUpdate ? 200 : 204,
            headers: responseHeaders
        };
        callback(null, response);
    }
    catch (error)
    {
        console.log("Failed to check vocaulary ready status", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ "message": "Failed to check vocaulary ready status: " + error })
        };
        callback(null, response);
    }

}