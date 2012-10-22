var http = require('http'), 
	util = require('util'),
	fs = require('fs'), 
	crypto = require('crypto'),
	url = require('url');

var s3_hostname = 's3.amazonaws.com';

var S3_SUB_RESOURCES = ['acl', 'lifecycle', 'location', 'logging', 'notification', 'partNumber', 'policy', 'requestPayment', 
                        'torrent','tagging', 'uploadId', 'uploads', 'versionId', 'versioning', 'versions', 'website','cors'];

var S3Auth = function(options){
	this.options = options;
	if(!this.options.date) this.options.date = ''; // prefer x-amz-date
	if(!this.options.headers) this.options.headers = {'x-amz-date' : this.options.date || new Date().toUTCString()};
	if(!this.options.headers['x-amz-date']) this.options.headers['x-amz-date'] =  this.options.date || new Date().toUTCString();
};

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
};
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
	console.log("STRING TO SIGN:"+stringToSign);
	return this.hmacSha1(stringToSign, options);
};
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
};

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
};

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
	var subresources = [], canonializedResource = this.createPath(this.options.bucket,awsurl.pathname || '');
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
};

S3Auth.prototype.createPath = function(bucket, pathname){
	var path ='';
	if(bucket.indexOf('/') !==0){
		path = '/'+bucket;
	}
	if(bucket.indexOf('/', bucket.length-1) === -1){
		path+='/';
	}
	return path+pathname;
}; 
/**
 * Constructor for the S3Client
 * @api public
 * @param {opt} options object
 */
var S3Client = module.exports =exports = function S3Client(opt){
	this.options = opt;
};

S3Client.prototype.createHostname = function(bucket, awshost){
	if(bucket.indexOf('.',bucket.length-1)!==-1) return bucket+awshost;
	return bucket+'.'+awshost;
};
/**
 * Creates a request to S3 
 * @param cb callback
 * @returns the request object
 * @api private
 */
S3Client.prototype.createRequest = function(options, cb){
	
	this.awsAuth=new S3Auth(options).createAuth();
	var headers = options.headers;
	if(options.contentType) headers['content-type'] = options.contentType;
	if(options.contentLength) headers['content-length'] =  options.contentLength;
	if(options.md5) headers['content-MD5'] = options.md5;
	headers['Authorization'] = this.awsAuth;

	var request = http.request({
		'hostname' : this.createHostname(options.bucket,s3_hostname),
		'method' : options.verb,
		'path' : '/'+options.resource,
		'headers' : headers
	});
	console.log(util.inspect(request));
	request.useChunkedEncodingByDefault = false;
	request.removeHeader('transfer-encoding');
	request.on('response', function(res) {
		if(cb) cb(null, res);
	});
	request.on('error', function(err) {
		if(cb) cb(err);
	});
	
	return request;
};

/**
 * Copy merge into to
 * @param to the opject to clone merge into
 * @param merge the object to add to 'to'
 * @returns to extended with merge
 */
S3Client.prototype.cloneOptions = function (to, merge){
		  var keys = Object.keys(merge);
		  for(i in keys){
			  var k = keys[i];
			  to[k]= merge[k];
		  }
		  return to;
};
/**
 * Does a post to S3 with the provided file 
 * @param {filetosend} the file to send to S3
 * @param {cb} response callback
 * @api public
 */
S3Client.prototype.put = function(filetosend,resourceToCreate, mime, fileSize, cb){
	console.log("put : "+resourceToCreate+' , '+filetosend);
	var localoptions = this.cloneOptions({verb : 'PUT', resource : resourceToCreate, contentType:mime, contentLength:fileSize}, this.options);
	

	var me = this;
	//TODO sucks refac
	if(localoptions.createmd5){
		var shasum = crypto.createHash('md5');
		var s = fs.ReadStream(filetosend);
		s.on('data', function(d) { shasum.update(d); });
		s.on('end', function() {
			localoptions.md5 = shasum.digest('base64');
		});
		s.on('close', function(){
				var req = me.createRequest(localoptions, cb);
			var readStream = fs.createReadStream(filetosend);
			readStream.pipe(req);
		});
	}else{
		var req = this.createRequest(localoptions, cb);
		var readStream = fs.createReadStream(filetosend);
		readStream.pipe(req);
	}

};

/**
 * Does a get (delete, get) to S3 
 * @param {cb} a callback to recieve the response
 * @api public
 */
S3Client.prototype.get = function(resource, cb){
	var localoptions = this.cloneOptions({verb: 'GET', resource: resource}, this.options);
	console.log("GET : "+resource);
	
	this.createRequest(localoptions, cb).end();
};

/**
 * Sends a delete ( get) to S3 
 * @param {cb} a callback to recieve the response
 * @param {fileToDelete} the name of the file to delete 
 * @api public
 */
S3Client.prototype.del = function(fileToDelete, cb){
	var localoptions = this.cloneOptions({verb: 'DELETE', resource: fileToDelete}, this.options);
	this.createRequest(localoptions, cb).end();
	
};
/**
 * Sends a delete ( get) to S3 
 * @param {cb} a callback to recieve the response
 * @param {readStream} stream to pipe to S3
 * @param {fileToStreamTo} the name of the file to stream content to
 * @api public
 */
S3Client.prototype.stream = function(fileToStreamTo, readStream, cb){
	var localoptions = this.cloneOptions({verb : 'PUT', resource : fileToStreamTo}, this.options);
	var s3stream = this.createRequest(localoptions,cb);
	readStream.pipe(s3stream);
};
