export function models_list() {
    return read_JSON('data/Models/exported_for_web.json');
}

export async function read_JSON(fname) {
    const response = await fetch(fname);
    if (response.ok) {
        const text_data = await response.text();
        return JSON.parse(text_data);
    } else {
        throw new Error(fname + ' not found');  // Could do console.error instead to avoid blocking
    }
}

