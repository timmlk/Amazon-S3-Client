var http = require('http'), 
	util = require('util'),
	fs = require('fs'), 
	crypto = require('crypto'),
	url = require('url');

var s3_hostname = 's3.amazonaws.com';

var S3_SUB_RESOURCES = ['acl', 'lifecycle', 'location', 'logging', 'notification', 'partNumber', 'policy', 'requestPayment', 
                        'torrent', 'uploadId', 'uploads', 'versionId', 'versioning', 'versions', 'website'];

var S3Auth = function(options){
	this.options = options;
	if(!this.options.date) this.options.date = ''; // prefer x-amz-date
	if(!this.options.headers) this.options.headers = {'x-amz-date' : this.options.date || new Date().toUTCString()};
	if(!this.options.headers['x-amz-date']) this.options.headers['x-amz-date'] =  this.options.date || new Date().toUTCString();
}

/**
 * 
 * @returns {String} signed authentication string
 */
S3Auth.prototype.createAuth = function(){
  return 'AWS ' + this.options.key + ':' + this.sign(this.options);
};

/**
 * convert URI resource identifier to canonialized resource
 * 	extract path
 * 	identify subresource (query paramters)s
 *  sort 	
 * 	append subresources 
 *  
 * @param {message} the message to sign
 * @param {options} the options object containing the secret key
 * @return {String}
 * @api private 
 */
S3Auth.prototype.hmacSha1 = function(message, options){
	  return crypto.createHmac('sha1', options.secret).update(message).digest('base64');
}
/**
 * StringToSign = HTTP-Verb + "\ n" + Content-MD5 + "\ n" + Content-Type + "\ n" +
 * Date + "\ n" + CanonicalizedAmzHeaders + CanonicalizedResource;
 * CanonicalizedResource = [ "/" + Bucket ] + < HTTP-Request-URI, from the
 * protocol name up to the query string >  + [ sub-resource, if
 * present. For example "? acl", "? location", "? logging", or "? torrent"];
 * @return {String}
 * @api private 
 */
S3Auth.prototype.sign = function(options){
	var stringToSign = this.stringToSign(options);
	var canonicalizedAmzHeaders = this.constructCanonicalizedAmzHeaders(options.headers);
	var canonicalizedResource = this.constructCanonicalizedResource(options.resource);
	stringToSign += canonicalizedAmzHeaders+'\n'; // +CanonicalizedAmzHeaders
	stringToSign += canonicalizedResource; // + CanonicalizedResource
	return this.hmacSha1(stringToSign, options);
}
/**
 * 
 *StringToSign = HTTP-Verb + "\ n" + Content-MD5 + "\ n" + Content-Type + "\ n" +
* Date + "\ n" + CanonicalizedAmzHeaders + CanonicalizedResource;
* @return {String}
* @api private  
*/
S3Auth.prototype.stringToSign = function(options){
	  return [
	      options.verb 
	    , options.md5 || ''
	    , options.contentType || ''
	    ,  options.headers['x-amz-date'] ? '' : options.date.toUTCString()
	  ].join('\n')+'\n';
}

/**
 *  convert each header name to lowercase
 *  sort by header name
 *  combine fields with same name into comma seperated list // todo
 *  Unfold long headers into one line 
 *  trim whitespace
 *  append newline to each header
 * @param {Object} amzHeaders
 * @return {String}
 * @api private
 */
S3Auth.prototype.constructCanonicalizedAmzHeaders = function(amzHeaders){
	var headers = [];
	for(header in amzHeaders){
		var val = amzHeaders[header];
		val.replace(' \n', ' ');//Unfold long headers into one line
		val = val.trim(); // trim whitespace
		var amzHeader = header.toLowerCase(); // convert each header name to lowercase
		headers.push(amzHeader+':'+val);
	}
	return headers.sort().join('\n'); // sort and append newline
}

/**
 * convert URI resource identifier to canonialized resource
 * 	extract path
 * 	identify subresource (query paramters)s
 *  sort 	
 * 	append subresources 
 *  
 * @param resouce
 * @return {String}
 * @api private 
 */
S3Auth.prototype.constructCanonicalizedResource = function(resource){
	var awsurl = url.parse(resource);
	var subresources = [], canonializedResource = this.options.bucket+(awsurl.pathname || '');
	if(awsurl.query){
		awsurl.query.split('&').forEach(function(param){
			var keyval = param.split('=');
			if(S3_SUB_RESOURCES.indexOf(keyval[0]) > -1 ){
				if(keyval.length > 1){
					subresources.push(keyval[0]+':'+keyval[1]);
				}else{
					subresources.push(keyval[0]);
				}
			}
		});	
	}
	if(subresources.length>0){
		canonializedResource += '?'+subresources.sort().join('&');
	}
	return canonializedResource;
}
/**
 * Constructor for the S3Client
 * @api public
 * @param {opt} options object
 */
var S3Client = module.exports =exports = function S3Client(opt){
	this.options = opt;
	this.awsAuth=new S3Auth(opt).createAuth();
}
/**
 * Creates a request to S3 
 * @param cb callback
 * @returns {___request1} the request object
 * @api private
 */
S3Client.prototype.createRequest = function(cb){
	var headers = this.options.headers;
	if(this.options.contentType) headers['content-type'] = this.options.contentType;
	if(this.options.contentLength) headers['content-length'] =  this.options.contentLength;
	headers['Authorization'] = this.awsAuth;
	var request = http.request({
		'hostname' : s3_hostname,
		'method' : this.options.verb,
		'path' :this.options.bucket+this.options.resource,
		'headers' : headers
	});
	request.useChunkedEncodingByDefault = false;
	request.removeHeader('transfer-encoding');
	request.on('response', function(res) {
		if(cb) cb(null, res);
	});
	request.on('error', function(err) {
		if(cb) cb(err);
	});
	return request;
}

/**
 * Does a post to S3 with the provided file 
 * @param {filetosend} the file to send to S3
 * @param {cb} response callback
 * @api public
 */
S3Client.prototype.put = function(filetosend, cb){
	console.log("put : "+this.options.resource+' , '+filetosend);
	var req = this.createRequest(cb);
	var readStream = fs.createReadStream(filetosend);
	readStream.pipe(req);
}

/**
 * Does a get (delete, get) to S3 
 * @param {cb} a callback to recieve the response
 * @api public
 */
S3Client.prototype.get = function( cb){
	console.log(this.options.verb +" : "+this.options.resource);
	
	var req = this.createRequest(cb);
	req.end();
}


