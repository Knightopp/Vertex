use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

pub fn compute_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];

    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let result = hasher.finalize();
    let hash_string = result
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    Ok(hash_string)
}

pub fn get_file_metadata(path: &Path) -> io::Result<(u64, u64)> {
    let metadata = fs::metadata(path)?;
    let size = metadata.len();
    let modified = metadata
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok((size, modified))
}
