CREATE TABLE smarttools.videos (
  videoId INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(45) NULL,
  contestId VARCHAR(45) NOT NULL,
  lastName VARCHAR(45) NULL,
  email VARCHAR(45) NULL,
  description VARCHAR(45) NULL,
  state VARCHAR(45) NOT NULL,
  uploadDate VARCHAR(45) NULL,
  PRIMARY KEY (videoId));

