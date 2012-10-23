S3Client
============

Simple express site to demonstrate integration to S3.

Description
-------------
This is a simple site that demonstrates integration to S3.  
All functionality for S3 is accessed through the S3Client.js file.


Usage:
------
Usage is fairly simple:  

var S3Client = require('S3Client');  

###Options object:
    options = {
        'key' : aws S3 key,
            'secret' : secret,
            'bucket' : bucket,
            'verb' : PUT, GET, DELETE,
            'resource' : resource on S3 to create, delet or query OPTIONAL,
            'contentType':file type for upload OPTIONAL,
            'contentLength' : filesize OPTIONAL, 
            'md5' : file MD5, if this is set then a a md5 wont be calculated OPTIONAL,
            'calcmd5' : set if you want the program to calculate a md5 hash for PUT
            'date' : request time OPTIONAL the system will insert an x-amz-date 
            'headers' : {'x-amz-date' : new Date().toUTCString(),? } OPTIONAL
    };

###Upload:
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
    };
    var client = new S3Client(options);
    
    client.put(filetosend,resourceToCreate, file.type, file.size, function(err,resp){
        // do something with response
    }

###Put text :
Upload of text to S3, as a file or as subresource(?acl)   
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
    };
    var client = new S3Client(options);
    
    client.putText(text,resource,  function(err,resp){
        // do something with response
    }

For example adding acl subresource to esiting item:  
    client.putText(aclxml,'cutedog.jpg?acl',  function(err,resp){
        // do something with response
    }
    
Or just putting text to a file  
    client.putText(text,'chrismaswishlist.txt',  function(err,resp){
        // do something with response
    }
    
###Delete:
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
            
    };
    var client = new S3Client(options);
    client.del(resourceToDelete, function(err,resp){
        // do something here
    }
    

###Get:
    var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket
    };
    var client = new S3Client(options);
    client.get(resourceToGetOrQuery, function(err,resp){
        // do something with response 
        resp.on('data', function(chunk) { // maybe bind to on data to get actual content
        });
        
    });
    
    ResourceToGetOrQuery can be many different things:
    '' (empty string) : lists content of bucket  
    ?xxx : query subresouce xxx (ie. acl, cors,...), seperate with
    xxx?yyy : query subresource xxx with specefied yyy option (ie. ?max-keys=50&prefix=20)
    filename : get file 

###AWS specific operations
List content of bucket :
   Do a GET and set resource to empty string   
   If you want to limit a list, then provide the parameters as a normal query string (ie. ?max-keys=50&prefix=bob)
   to the get resource option    
       client.get('', function(err,resp){}); //list bucket content  
       or  
       client.get('?max-keys=50&prefix=bob', function(err,resp){}); // list bucket content but list only first 50 items starting with 'bob'  
   
    
To do specific subresource gets, append the subresource as normal to the resource for example ?acl   
    
     var options = {
            'key' : keyId,
            'secret' : secret,
            'bucket' : bucket,
    };
    client.get('?acl', function(err,resp){}); //get acl for bucket
    client.get('filename?acl', function(err,resp){}); //get acl for file item

TODO 
-----------
REFAC MD5 calculation  
multipart upload to S3  
test of S3Client  
Put bucket ? how?  

##NOTES
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