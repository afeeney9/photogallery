CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(255),
  password VARCHAR(255)
);

CREATE TABLE photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  photo_url TEXT,
  photo_name TEXT
);
