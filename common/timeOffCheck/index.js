
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});

const cron_holidays = [
            '2022-02-21', // presidents day
            '2022-03-31', // cesar chavez day
            '2022-05-30', // memorial day
            '2022-05-31', // Tuesday after memorial day
            '2022-07-04', // independence day
            '2022-07-05', // Tuesday after independence day
            '2022-09-05', // labor day
            '2022-09-06', // Tuesday after labor day
            '2022-11-11', // veterans day
            '2022-11-24', // thanksgiving
            '2022-11-25', // day after thanksgiving
            '2022-12-25', // christmas
            ]

const isIdleDay = ({weekends_off = true, holidays_off = true, first_week_only = false, day_delta = 0}) => {
    const todayDateStr = todayDateString();

    var check_date = new Date();
    if (day_delta != 0) {
        // For preview jobs, we may add a day or two so we compare against the publication day 
        // to determine whether the preview can be skipped
        check_date.setDate(check_date.getDate() + day_delta);
    }
    const dayOfWeekIdx = check_date.getDay(); // sunday is zero
    const dayOfMonth = check_date.getDate(); // 1-31
    if (holidays_off && cron_holidays.includes(todayDateStr)) {
        return true;
    }
    if (weekends_off && (dayOfWeekIdx == 0 || dayOfWeekIdx == 6)) {
        return true;
    }
    if (first_week_only && (dayOfMonth > 7)) {
        return true;
    }
    return false;
};

/*
 * Precomputed data about each day of the week to support finding, for example,
 * the first Monday after the first Tuesday in a given month.
 *
 * @idx: maps day name to day of the week index so the user can specify days
 *       using English in isFirstOccurrence
 * @min_date: records the first possible day of the *month* that a day of the *week*
 *            can occur on and still occur AFTER the given day of the *week*.
 *        Ex: lowest day of month a Sunday  can occur on after a Sunday is 8   (see 'Sun', index 0)
 *        Ex: lowest day of month a Monday  can occur on after a Sunday is 2   (see 'Sun', index 1)
 *        Ex: lowest day of month a Tuesday can occur on after a Sunday is 3   (see 'Sun', index 2)
 *        Ex: lowest day of month a Tuesday can occur on after a Monday is 2   (see 'Mon', index 2)
 */
const day_info = {
    'Sun': {idx: 0, min_date: [8,2,3,4,5,6,7]},
    'Mon': {idx: 1, min_date: [7,8,2,3,4,5,6]},
    'Tue': {idx: 2, min_date: [6,7,8,2,3,4,5]},
    'Wed': {idx: 3, min_date: [5,6,7,8,2,3,4]},
    'Thu': {idx: 4, min_date: [4,5,6,7,8,2,3]},
    'Fri': {idx: 5, min_date: [3,4,5,6,7,8,2]},
    'Sat': {idx: 6, min_date: [2,3,4,5,6,7,8]}
};

/*
 * At the time of writing, health equity data is refreshed on the first Friday
 * of the month. To pick this new data up our automation needs to run the
 * subsequent week (note that preview jobs run on Monday and production jobs on
 * Thursday). Since automation runs weekly but is only needed once a month, we
 * need to be able to detect which days are valid to run on.
 *
 * This function returns true if the current date is the first of occurrence of
 * a given day in a week AFTER another specified day of the week. 
 */
const isFirstOccurrence = (first_day = 'Sun', after_first = 'Sun', day_delta = 0) => {
    var check_date = new Date();

    /* currently only used for testing */
    if (day_delta != 0) {
        check_date.setDate(check_date.getDate() + day_delta);
    }

    const dayOfWeekIdx = check_date.getDay(); // sunday is zero
    const dayOfMonth = check_date.getDate(); // 1-31

    const look_idx  = day_info[first_day].idx;
    const after_idx = day_info[after_first].idx;

    /* If today is not the specified day of the week we have nothing to do. */
    if (dayOfWeekIdx != look_idx) {
        return false;
    }

    const min_date = day_info[after_first].min_date[look_idx];
    const max_date = min_date + 6;

    if (dayOfMonth < min_date || dayOfMonth > max_date) {
        return false;
    }
    return true;
};

module.exports = {
    isIdleDay,
    isFirstOccurrence
};
