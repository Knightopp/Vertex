use std::ffi::OsStr;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
};

#[derive(Debug, Default, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub product_name: Option<String>,
    pub file_description: Option<String>,
    pub company_name: Option<String>,
}

pub fn get_file_metadata(path: &str) -> FileMetadata {
    let mut meta = FileMetadata::default();

    let path_wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let pcwstr = PCWSTR::from_raw(path_wide.as_ptr());

    unsafe {
        let mut handle = 0;
        let size = GetFileVersionInfoSizeW(pcwstr, Some(&mut handle));
        if size == 0 {
            return meta;
        }

        let mut buffer = vec![0u8; size as usize];
        if GetFileVersionInfoW(pcwstr, 0, size, buffer.as_mut_ptr() as *mut _).is_err() {
            return meta;
        }

        // Get translation
        let mut trans_len = 0;
        let mut trans_ptr = std::ptr::null_mut();
        let trans_query: Vec<u16> = OsStr::new("\\VarFileInfo\\Translation")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut lang_code = 0x0409;
        let mut code_page = 0x04b0;

        if VerQueryValueW(
            buffer.as_ptr() as *const _,
            PCWSTR::from_raw(trans_query.as_ptr()),
            &mut trans_ptr,
            &mut trans_len,
        )
        .as_bool()
            && trans_len >= 4
        {
            let trans = std::slice::from_raw_parts(trans_ptr as *const u16, 2);
            lang_code = trans[0];
            code_page = trans[1];
        }

        meta.product_name = query_string_value(&buffer, lang_code, code_page, "ProductName");
        meta.file_description =
            query_string_value(&buffer, lang_code, code_page, "FileDescription");
        meta.company_name = query_string_value(&buffer, lang_code, code_page, "CompanyName");
    }

    meta
}

unsafe fn query_string_value(buffer: &[u8], lang: u16, code: u16, name: &str) -> Option<String> {
    let query = format!("\\StringFileInfo\\{:04x}{:04x}\\{}", lang, code, name);
    let query_wide: Vec<u16> = OsStr::new(&query)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut val_len = 0;
    let mut val_ptr = std::ptr::null_mut();

    if VerQueryValueW(
        buffer.as_ptr() as *const _,
        PCWSTR::from_raw(query_wide.as_ptr()),
        &mut val_ptr,
        &mut val_len,
    )
    .as_bool()
        && val_len > 0
    {
        let val = std::slice::from_raw_parts(val_ptr as *const u16, (val_len - 1) as usize);
        let s = std::ffi::OsString::from_wide(val)
            .to_string_lossy()
            .into_owned();
        if !s.trim().is_empty() {
            return Some(s.trim().to_string());
        }
    }

    None
}
