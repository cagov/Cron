
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
            '2022-11-11', // veterens day
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


module.exports = {
    isIdleDay
};
