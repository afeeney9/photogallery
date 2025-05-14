CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(255),
  password VARCHAR(255)
);

CREATE TABLE photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  photo_url TEXT,
  photo_name TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
