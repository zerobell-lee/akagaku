export const formatDatetime = (date: Date): string => {
    const localeString = date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
    return localeString;
}

export const parseDatetime = (localeString: string): Date => {
    return new Date(localeString);
}
