import { Storage } from '@google-cloud/storage';

// Replace with the path to your service account key file
const keyFilename = './key.json';

// Replace with the name of your Cloud Storage bucket
const bucketName = 'my-terraform-gcs';

// Initialize Google Cloud Storage with the service account key
const storage = new Storage({ keyFilename });

const uploadToFirebaseStorage = async (filepath, fileName) => {
    try {
        const gcs = storage.bucket(bucketName);
        const storagepath = `photos/${fileName}`; // Path in the bucket
        const file = gcs.file(storagepath);

        // Get the file extension from the filename to set the appropriate content type
        const ext = fileName.split('.').pop();
        let contentType = 'application/octet-stream'; // Default content type

        // Set content type based on file extension
        if (ext === 'jpg' || ext === 'jpeg') {
            contentType = 'image/jpeg';
        } else if (ext === 'png') {
            contentType = 'image/png';
        } else if (ext === 'gif') {
            contentType = 'image/gif';
        }

        const result = await gcs.upload(filepath, {
            destination: storagepath,
            predefinedAcl: 'publicRead', // Set the file to be publicly readable
            metadata: {
                contentType: contentType, // Set the correct content type based on file extension
            }
        });

        return result[0].metadata.mediaLink; // Return the URL of the uploaded file
    } catch (error) {
        console.log(error);
        throw new Error(error.message);
    }
}

// Call the function with the actual file path and file name
const uploadfilepath = './image.jpg';  // Specify the file path here
let result = await uploadToFirebaseStorage(uploadfilepath, 'image.jpg');
console.log(result);

