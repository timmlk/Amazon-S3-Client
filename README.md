S3Client
============

Simple express site to demonstrate integration to S3.

Description
-------------
This is a simple site that demonstrates integration to S3.  
At this point all functionality for S3 is in the S3Client.js file.


Usage:
------
Usage is fairly simple:



###Upload:
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
            'verb' : 'PUT',
            'resource' : file.name,
            'contentType':file.type,
            'contentLength' : file.size, 
            'md5' : '',
            'res' : res,
            'headers' : {'x-amz-date' : new Date().toUTCString()}
    };
    var client = new S3Client(options);
    client.put(fileToPut, function(err,resp){
        // do something with response
    }
    
###Delete:
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
            'verb' : 'DELETE',
            'resource' : fileToDelete,
            'headers' : {'x-amz-date' : new Date().toUTCString()}
    };
    var client = new S3Client(options);
    client.get(function(err,resp){
        // do something here
    }
    

###Get:
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
            'verb' : 'GET',
            'resource' : req.body['query'],
            'headers' : {'x-amz-date' : new Date().toUTCString()}
    };
    var client = new S3Client(options);
    client.get(function(err,resp){
        // do something with response 
        resp.on('data', function(chunk) { // maybe bind to on data to get actual content
        });
        
    });

###AWS specific operations
List content of bucket :
   Do a GET and set resource to empty string   
   If you want to limit a list, then provide the parameters as a normal query string (ie. ?max-keys=50&prefix=bob)
   to the get resource option    
   
     var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
            'verb' : 'GET',
            'resource' : '?max-keys=50&prefix=bob',
    };
    
To do specific subresource gets, append the subresource as normal to the resource for example ?acl   
    
     var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
            'verb' : 'GET',
            'resource' : '?acl',
    };
    

TODO
------


NOTES
Remeber to set bucket policy to public read 
    {
      "Version":"2008-10-17",
      "Statement":[{
        "Sid":"AddPerm",
            "Effect":"Allow",
          "Principal": {
                "AWS": "*"
             },
          "Action":["s3:GetObject"],
          "Resource":["arn:aws:s3:::bucket/*"
          ]
        }
      ]
    }

Direct upload requires s3:putObjectACL for the user that signs the policy for the request   