// Common topic vocabulary. Rows are Hanzi | tone-marked Pinyin | Vietnamese.
const rows = text => text.trim().split('\n').map(line => line.split('|'));

export const EXTRA_WORDS = {
  family: rows(`
父亲|fù qīn|Cha
母亲|mǔ qīn|Mẹ
亲人|qīn rén|Người thân
亲戚|qīn qi|Họ hàng
叔叔|shū shu|Chú
阿姨|ā yí|Dì; cô
伯伯|bó bo|Bác trai
舅舅|jiù jiu|Cậu
姑姑|gū gu|Cô ruột
孙子|sūn zi|Cháu trai nội
孙女|sūn nǚ|Cháu gái nội
外孙|wài sūn|Cháu trai ngoại
外孙女|wài sūn nǚ|Cháu gái ngoại
夫妻|fū qī|Vợ chồng
兄弟|xiōng dì|Anh em trai
姐妹|jiě mèi|Chị em gái
祖父|zǔ fù|Ông nội
祖母|zǔ mǔ|Bà nội
表哥|biǎo gē|Anh họ
表姐|biǎo jiě|Chị họ
堂哥|táng gē|Anh họ bên nội
堂姐|táng jiě|Chị họ bên nội
结婚|jié hūn|Kết hôn
照顾|zhào gù|Chăm sóc`),
  food: rows(`
牛排|niú pái|Bít tết bò
猪排|zhū pái|Sườn lợn
烤鸭|kǎo yā|Vịt quay
烤肉|kǎo ròu|Thịt nướng
火锅|huǒ guō|Lẩu
炒饭|chǎo fàn|Cơm rang
粥|zhōu|Cháo
馒头|mán tou|Bánh màn thầu
蛋糕|dàn gāo|Bánh ngọt
饼干|bǐng gān|Bánh quy
巧克力|qiǎo kè lì|Sô cô la
冰淇淋|bīng qí lín|Kem
沙拉|shā lā|Xa lát
香肠|xiāng cháng|Xúc xích
虾|xiā|Tôm
蟹|xiè|Cua
蘑菇|mó gu|Nấm
西红柿|xī hóng shì|Cà chua
黄瓜|huáng guā|Dưa chuột
胡萝卜|hú luó bo|Cà rốt
洋葱|yáng cōng|Hành tây
盐|yán|Muối
油|yóu|Dầu ăn
醋|cù|Giấm`),
  drinks: rows(`
白开水|bái kāi shuǐ|Nước đun sôi
矿泉水|kuàng quán shuǐ|Nước khoáng
纯净水|chún jìng shuǐ|Nước tinh khiết
温水|wēn shuǐ|Nước ấm
热茶|rè chá|Trà nóng
冰茶|bīng chá|Trà đá
乌龙茶|wū lóng chá|Trà ô long
花茶|huā chá|Trà hoa
菊花茶|jú huā chá|Trà hoa cúc
柠檬茶|níng méng chá|Trà chanh
珍珠奶茶|zhēn zhū nǎi chá|Trà sữa trân châu
奶昔|nǎi xī|Sữa lắc
可可|kě kě|Ca cao
热巧克力|rè qiǎo kè lì|Sô cô la nóng
椰子水|yē zi shuǐ|Nước dừa
西瓜汁|xī guā zhī|Nước ép dưa hấu
苹果汁|píng guǒ zhī|Nước ép táo
葡萄汁|pú tao zhī|Nước ép nho
葡萄酒|pú tao jiǔ|Rượu vang
啤酒|pí jiǔ|Bia
酒|jiǔ|Rượu
一杯|yì bēi|Một cốc
一瓶|yì píng|Một chai
续杯|xù bēi|Châm thêm đồ uống`),
  school: rows(`
校长|xiào zhǎng|Hiệu trưởng
班级|bān jí|Lớp học
同桌|tóng zhuō|Bạn cùng bàn
课本|kè běn|Sách giáo khoa
课表|kè biǎo|Thời khóa biểu
课程|kè chéng|Khóa học
语文|yǔ wén|Môn ngữ văn
历史|lì shǐ|Lịch sử
地理|dì lǐ|Địa lý
生物|shēng wù|Sinh học
物理|wù lǐ|Vật lý
化学|huà xué|Hóa học
音乐|yīn yuè|Âm nhạc
美术|měi shù|Mỹ thuật
体育|tǐ yù|Thể dục
操场|cāo chǎng|Sân trường
食堂|shí táng|Nhà ăn
宿舍|sù shè|Ký túc xá
粉笔|fěn bǐ|Phấn viết bảng
文具|wén jù|Văn phòng phẩm
笔记|bǐ jì|Ghi chép
练习|liàn xí|Luyện tập
成绩|chéng jì|Thành tích học tập
毕业|bì yè|Tốt nghiệp`),
  travel: rows(`
公交车|gōng jiāo chē|Xe buýt
出租车|chū zū chē|Taxi
高铁|gāo tiě|Tàu cao tốc
轮船|lún chuán|Tàu thủy
自行车|zì xíng chē|Xe đạp
地铁站|dì tiě zhàn|Ga tàu điện ngầm
站台|zhàn tái|Sân ga
月台|yuè tái|Ke ga
航班|háng bān|Chuyến bay
登机牌|dēng jī pái|Thẻ lên máy bay
登机口|dēng jī kǒu|Cửa lên máy bay
机票|jī piào|Vé máy bay
订票|dìng piào|Đặt vé
退票|tuì piào|Trả vé
预订|yù dìng|Đặt trước
住宿|zhù sù|Lưu trú
入住|rù zhù|Nhận phòng
退房|tuì fáng|Trả phòng
行程|xíng chéng|Lịch trình
目的地|mù dì dì|Điểm đến
游客|yóu kè|Du khách
纪念品|jì niàn pǐn|Quà lưu niệm
风景|fēng jǐng|Phong cảnh
迷路|mí lù|Lạc đường`),
  shopping: rows(`
顾客|gù kè|Khách hàng
售货员|shòu huò yuán|Nhân viên bán hàng
收银台|shōu yín tái|Quầy thu ngân
购物车|gòu wù chē|Xe đẩy mua hàng
购物袋|gòu wù dài|Túi mua hàng
商品|shāng pǐn|Hàng hóa
品牌|pǐn pái|Thương hiệu
质量|zhì liàng|Chất lượng
尺寸|chǐ cùn|Kích thước
大号|dà hào|Cỡ lớn
中号|zhōng hào|Cỡ vừa
小号|xiǎo hào|Cỡ nhỏ
外套|wài tào|Áo khoác
裙子|qún zi|Váy
衬衫|chèn shān|Áo sơ mi
毛衣|máo yī|Áo len
袜子|wà zi|Tất
手套|shǒu tào|Găng tay
围巾|wéi jīn|Khăn quàng
皮带|pí dài|Thắt lưng
钱包|qián bāo|Ví tiền
信用卡|xìn yòng kǎ|Thẻ tín dụng
优惠|yōu huì|Ưu đãi
包邮|bāo yóu|Miễn phí giao hàng`)
};

export const NEW_TOPICS = [
  ['animals', 'Động vật', 'Gặp những người bạn trong thế giới tự nhiên', '#E1BC85', 'Khám phá vườn thú', rows(`
猫|māo|Mèo
狗|gǒu|Chó
鸟|niǎo|Chim
鱼|yú|Cá
兔子|tù zi|Thỏ
老鼠|lǎo shǔ|Chuột
马|mǎ|Ngựa
牛|niú|Bò
羊|yáng|Dê; cừu
猪|zhū|Lợn
鸡|jī|Gà
鸭子|yā zi|Vịt
鹅|é|Ngỗng
熊猫|xióng māo|Gấu trúc
熊|xióng|Gấu
老虎|lǎo hǔ|Hổ
狮子|shī zi|Sư tử
大象|dà xiàng|Voi
猴子|hóu zi|Khỉ
长颈鹿|cháng jǐng lù|Hươu cao cổ
斑马|bān mǎ|Ngựa vằn
鹿|lù|Hươu
狼|láng|Sói
狐狸|hú li|Cáo
松鼠|sōng shǔ|Sóc
袋鼠|dài shǔ|Chuột túi
骆驼|luò tuo|Lạc đà
河马|hé mǎ|Hà mã
犀牛|xī niú|Tê giác
鳄鱼|è yú|Cá sấu
蛇|shé|Rắn
乌龟|wū guī|Rùa
青蛙|qīng wā|Ếch
蝴蝶|hú dié|Bướm
蜜蜂|mì fēng|Ong
蚂蚁|mǎ yǐ|Kiến
蚊子|wén zi|Muỗi
苍蝇|cāng ying|Ruồi
蜘蛛|zhī zhū|Nhện
蜗牛|wō niú|Ốc sên
企鹅|qǐ é|Chim cánh cụt
海豚|hǎi tún|Cá heo
鲸鱼|jīng yú|Cá voi
鲨鱼|shā yú|Cá mập
海龟|hǎi guī|Rùa biển
螃蟹|páng xiè|Cua
虾|xiā|Tôm
章鱼|zhāng yú|Bạch tuộc
宠物|chǒng wù|Thú cưng
动物|dòng wù|Động vật`)],
  ['nature', 'Thiên nhiên', 'Đi qua rừng xanh, biển rộng và núi cao', '#8BD1A0', 'Ghi lại cảnh sắc thiên nhiên', rows(`
自然|zì rán|Thiên nhiên
天空|tiān kōng|Bầu trời
太阳|tài yáng|Mặt trời
月亮|yuè liang|Mặt trăng
星星|xīng xing|Ngôi sao
地球|dì qiú|Trái đất
森林|sēn lín|Rừng
树|shù|Cây
树叶|shù yè|Lá cây
花|huā|Hoa
草|cǎo|Cỏ
竹子|zhú zi|Tre
山|shān|Núi
河|hé|Sông
海|hǎi|Biển
湖|hú|Hồ
小溪|xiǎo xī|Suối nhỏ
瀑布|pù bù|Thác nước
沙漠|shā mò|Sa mạc
岛|dǎo|Đảo
海滩|hǎi tān|Bãi biển
田野|tián yě|Đồng ruộng
土地|tǔ dì|Đất đai
石头|shí tou|Hòn đá
沙子|shā zi|Cát
泥土|ní tǔ|Đất bùn
空气|kōng qì|Không khí
水|shuǐ|Nước
火|huǒ|Lửa
木头|mù tou|Gỗ
植物|zhí wù|Thực vật
种子|zhǒng zi|Hạt giống
根|gēn|Rễ
树枝|shù zhī|Cành cây
树干|shù gàn|Thân cây
花园|huā yuán|Vườn hoa
草地|cǎo dì|Bãi cỏ
山谷|shān gǔ|Thung lũng
山顶|shān dǐng|Đỉnh núi
山洞|shān dòng|Hang núi
岩石|yán shí|Đá
环境|huán jìng|Môi trường
风景|fēng jǐng|Phong cảnh
阳光|yáng guāng|Ánh nắng
彩虹|cǎi hóng|Cầu vồng
露水|lù shuǐ|Sương đọng
冰|bīng|Băng
雪花|xuě huā|Bông tuyết
地面|dì miàn|Mặt đất
海洋|hǎi yáng|Đại dương`)],
  ['weather', 'Thời tiết', 'Nắng mưa và bốn mùa quanh bạn', '#9ECBE5', 'Hoàn thành bản tin thời tiết', rows(`
天气|tiān qì|Thời tiết
晴天|qíng tiān|Ngày nắng
阴天|yīn tiān|Ngày âm u
多云|duō yún|Nhiều mây
下雨|xià yǔ|Mưa
下雪|xià xuě|Tuyết rơi
刮风|guā fēng|Gió thổi
雷电|léi diàn|Sấm sét
打雷|dǎ léi|Sấm nổ
闪电|shǎn diàn|Chớp
暴雨|bào yǔ|Mưa lớn dữ dội
小雨|xiǎo yǔ|Mưa nhỏ
大雨|dà yǔ|Mưa to
阵雨|zhèn yǔ|Mưa rào
雨伞|yǔ sǎn|Ô đi mưa
雨衣|yǔ yī|Áo mưa
雪|xuě|Tuyết
雾|wù|Sương mù
霜|shuāng|Sương giá
冰雹|bīng báo|Mưa đá
台风|tái fēng|Bão nhiệt đới
暴风雨|bào fēng yǔ|Mưa bão
气温|qì wēn|Nhiệt độ không khí
温度|wēn dù|Nhiệt độ
湿度|shī dù|Độ ẩm
寒冷|hán lěng|Rét lạnh
炎热|yán rè|Nóng bức
凉快|liáng kuai|Mát mẻ
温暖|wēn nuǎn|Ấm áp
干燥|gān zào|Khô ráo
潮湿|cháo shī|Ẩm ướt
春天|chūn tiān|Mùa xuân
夏天|xià tiān|Mùa hè
秋天|qiū tiān|Mùa thu
冬天|dōng tiān|Mùa đông
季节|jì jié|Mùa
晴朗|qíng lǎng|Quang đãng
闷热|mēn rè|Oi bức
晴|qíng|Nắng ráo
冷|lěng|Lạnh
热|rè|Nóng
风|fēng|Gió
云|yún|Mây
雨|yǔ|Mưa
结冰|jié bīng|Đóng băng
融化|róng huà|Tan chảy
天气预报|tiān qì yù bào|Dự báo thời tiết
降温|jiàng wēn|Giảm nhiệt độ
升温|shēng wēn|Tăng nhiệt độ
气候|qì hòu|Khí hậu`)],
  ['body', 'Cơ thể', 'Nhận biết các bộ phận trên cơ thể', '#E7B4A7', 'Hoàn thiện bản đồ cơ thể', rows(`
身体|shēn tǐ|Cơ thể
头|tóu|Đầu
头发|tóu fa|Tóc
脸|liǎn|Mặt
眼睛|yǎn jing|Mắt
耳朵|ěr duo|Tai
鼻子|bí zi|Mũi
嘴|zuǐ|Miệng
牙齿|yá chǐ|Răng
舌头|shé tou|Lưỡi
脖子|bó zi|Cổ
肩膀|jiān bǎng|Vai
手臂|shǒu bì|Cánh tay
胳膊|gē bo|Cánh tay
手|shǒu|Tay
手指|shǒu zhǐ|Ngón tay
指甲|zhǐ jia|Móng tay
胸部|xiōng bù|Ngực
背|bèi|Lưng
肚子|dù zi|Bụng
腰|yāo|Eo
腿|tuǐ|Chân
膝盖|xī gài|Đầu gối
脚|jiǎo|Bàn chân
脚趾|jiǎo zhǐ|Ngón chân
皮肤|pí fū|Da
骨头|gǔ tou|Xương
肌肉|jī ròu|Cơ bắp
心脏|xīn zàng|Tim
大脑|dà nǎo|Não
肺|fèi|Phổi
胃|wèi|Dạ dày
肝|gān|Gan
血|xuè|Máu
血管|xuè guǎn|Mạch máu
眉毛|méi mao|Lông mày
睫毛|jié máo|Lông mi
额头|é tóu|Trán
下巴|xià ba|Cằm
脸颊|liǎn jiá|Má
喉咙|hóu lóng|Cổ họng
手腕|shǒu wàn|Cổ tay
手掌|shǒu zhǎng|Lòng bàn tay
手背|shǒu bèi|Mu bàn tay
脚踝|jiǎo huái|Mắt cá chân
脚跟|jiǎo gēn|Gót chân
关节|guān jié|Khớp
肘部|zhǒu bù|Khuỷu tay
呼吸|hū xī|Hô hấp
脉搏|mài bó|Mạch đập`)],
  ['health', 'Sức khỏe', 'Từ thường dùng khi chăm sóc sức khỏe', '#8ED5CA', 'Chuẩn bị hành trang sức khỏe', rows(`
健康|jiàn kāng|Sức khỏe
医院|yī yuàn|Bệnh viện
医生|yī shēng|Bác sĩ
护士|hù shi|Y tá
病人|bìng rén|Bệnh nhân
看病|kàn bìng|Khám bệnh
生病|shēng bìng|Bị ốm
感冒|gǎn mào|Cảm lạnh
发烧|fā shāo|Sốt
咳嗽|ké sou|Ho
头疼|tóu téng|Đau đầu
肚子疼|dù zi téng|Đau bụng
牙疼|yá téng|Đau răng
疼痛|téng tòng|Đau đớn
过敏|guò mǐn|Dị ứng
受伤|shòu shāng|Bị thương
伤口|shāng kǒu|Vết thương
流血|liú xuè|Chảy máu
药|yào|Thuốc
吃药|chī yào|Uống thuốc
药店|yào diàn|Hiệu thuốc
药片|yào piàn|Viên thuốc
药水|yào shuǐ|Thuốc dạng nước
体温|tǐ wēn|Thân nhiệt
量体温|liáng tǐ wēn|Đo thân nhiệt
体温计|tǐ wēn jì|Nhiệt kế
口罩|kǒu zhào|Khẩu trang
洗手|xǐ shǒu|Rửa tay
消毒|xiāo dú|Khử trùng
检查|jiǎn chá|Kiểm tra
体检|tǐ jiǎn|Khám sức khỏe
挂号|guà hào|Đăng ký khám
预约|yù yuē|Đặt lịch hẹn
急诊|jí zhěn|Cấp cứu
救护车|jiù hù chē|Xe cứu thương
住院|zhù yuàn|Nằm viện
出院|chū yuàn|Xuất viện
手术|shǒu shù|Phẫu thuật
治疗|zhì liáo|Điều trị
休息|xiū xi|Nghỉ ngơi
睡觉|shuì jiào|Ngủ
睡眠|shuì mián|Giấc ngủ
营养|yíng yǎng|Dinh dưỡng
锻炼|duàn liàn|Rèn luyện
恢复|huī fù|Hồi phục
康复|kāng fù|Bình phục
血压|xuè yā|Huyết áp
疫苗|yì miáo|Vắc xin
病历|bìng lì|Bệnh án
医疗|yī liáo|Y tế`)],
  ['sports', 'Thể thao', 'Vận động, luyện tập và thi đấu', '#A8BEEB', 'Hoàn thành buổi luyện tập', rows(`
运动|yùn dòng|Vận động
体育|tǐ yù|Thể thao
跑步|pǎo bù|Chạy bộ
散步|sàn bù|Đi dạo
游泳|yóu yǒng|Bơi lội
骑车|qí chē|Đạp xe
爬山|pá shān|Leo núi
跳绳|tiào shéng|Nhảy dây
跳舞|tiào wǔ|Nhảy múa
足球|zú qiú|Bóng đá
篮球|lán qiú|Bóng rổ
排球|pái qiú|Bóng chuyền
网球|wǎng qiú|Quần vợt
乒乓球|pīng pāng qiú|Bóng bàn
羽毛球|yǔ máo qiú|Cầu lông
棒球|bàng qiú|Bóng chày
高尔夫球|gāo ěr fū qiú|Gôn
滑雪|huá xuě|Trượt tuyết
滑冰|huá bīng|Trượt băng
冲浪|chōng làng|Lướt sóng
瑜伽|yú jiā|Yoga
体操|tǐ cāo|Thể dục dụng cụ
武术|wǔ shù|Võ thuật
太极拳|tài jí quán|Thái cực quyền
健身|jiàn shēn|Tập thể hình
健身房|jiàn shēn fáng|Phòng tập
球场|qiú chǎng|Sân bóng
游泳池|yóu yǒng chí|Bể bơi
运动员|yùn dòng yuán|Vận động viên
教练|jiào liàn|Huấn luyện viên
裁判|cái pàn|Trọng tài
比赛|bǐ sài|Thi đấu
训练|xùn liàn|Huấn luyện
球队|qiú duì|Đội bóng
队友|duì yǒu|Đồng đội
对手|duì shǒu|Đối thủ
冠军|guàn jūn|Nhà vô địch
奖牌|jiǎng pái|Huy chương
奖杯|jiǎng bēi|Cúp
得分|dé fēn|Ghi điểm
赢|yíng|Thắng
输|shū|Thua
平局|píng jú|Hòa
进球|jìn qiú|Ghi bàn
发球|fā qiú|Phát bóng
接球|jiē qiú|Đỡ bóng
热身|rè shēn|Khởi động
拉伸|lā shēn|Giãn cơ
耐力|nài lì|Sức bền
速度|sù dù|Tốc độ`)],
  ['work', 'Công việc', 'Nghề nghiệp và một ngày ở nơi làm việc', '#C0B2DD', 'Hoàn tất nhiệm vụ công việc', rows(`
工作|gōng zuò|Công việc
公司|gōng sī|Công ty
办公室|bàn gōng shì|Văn phòng
同事|tóng shì|Đồng nghiệp
老板|lǎo bǎn|Ông chủ
员工|yuán gōng|Nhân viên
经理|jīng lǐ|Quản lý
会议|huì yì|Cuộc họp
开会|kāi huì|Họp
项目|xiàng mù|Dự án
任务|rèn wu|Nhiệm vụ
计划|jì huà|Kế hoạch
报告|bào gào|Báo cáo
文件|wén jiàn|Tài liệu
合同|hé tong|Hợp đồng
工资|gōng zī|Tiền lương
奖金|jiǎng jīn|Tiền thưởng
上班|shàng bān|Đi làm
下班|xià bān|Tan làm
加班|jiā bān|Làm thêm giờ
请假|qǐng jià|Xin nghỉ
休假|xiū jià|Nghỉ phép
出差|chū chāi|Đi công tác
面试|miàn shì|Phỏng vấn
简历|jiǎn lì|Sơ yếu lý lịch
招聘|zhāo pìn|Tuyển dụng
应聘|yìng pìn|Ứng tuyển
培训|péi xùn|Đào tạo
经验|jīng yàn|Kinh nghiệm
职业|zhí yè|Nghề nghiệp
工程师|gōng chéng shī|Kỹ sư
程序员|chéng xù yuán|Lập trình viên
设计师|shè jì shī|Nhà thiết kế
会计|kuài jì|Kế toán
律师|lǜ shī|Luật sư
记者|jì zhě|Nhà báo
司机|sī jī|Tài xế
厨师|chú shī|Đầu bếp
服务员|fú wù yuán|Nhân viên phục vụ
警察|jǐng chá|Cảnh sát
消防员|xiāo fáng yuán|Lính cứu hỏa
工人|gōng rén|Công nhân
农民|nóng mín|Nông dân
教师|jiào shī|Giáo viên
医生|yī shēng|Bác sĩ
护士|hù shi|Y tá
翻译|fān yì|Phiên dịch
导游|dǎo yóu|Hướng dẫn viên
商人|shāng rén|Thương nhân
秘书|mì shū|Thư ký`)],
  ['time', 'Thời gian', 'Ngày tháng, giờ giấc và các mốc quen thuộc', '#E5CAA0', 'Sắp xếp lịch trình trong ngày', rows(`
时间|shí jiān|Thời gian
现在|xiàn zài|Bây giờ
过去|guò qù|Quá khứ
将来|jiāng lái|Tương lai
今天|jīn tiān|Hôm nay
明天|míng tiān|Ngày mai
昨天|zuó tiān|Hôm qua
前天|qián tiān|Hôm kia
后天|hòu tiān|Ngày kia
早上|zǎo shang|Buổi sáng
上午|shàng wǔ|Trước buổi trưa
中午|zhōng wǔ|Buổi trưa
下午|xià wǔ|Buổi chiều
晚上|wǎn shang|Buổi tối
夜里|yè li|Ban đêm
凌晨|líng chén|Rạng sáng
小时|xiǎo shí|Giờ
分钟|fēn zhōng|Phút
秒|miǎo|Giây
点|diǎn|Giờ; điểm
半|bàn|Nửa
刻|kè|Một phần tư giờ
一天|yì tiān|Một ngày
星期|xīng qī|Tuần
周末|zhōu mò|Cuối tuần
星期一|xīng qī yī|Thứ hai
星期二|xīng qī èr|Thứ ba
星期三|xīng qī sān|Thứ tư
星期四|xīng qī sì|Thứ năm
星期五|xīng qī wǔ|Thứ sáu
星期六|xīng qī liù|Thứ bảy
星期天|xīng qī tiān|Chủ nhật
月|yuè|Tháng
年|nián|Năm
今年|jīn nián|Năm nay
明年|míng nián|Năm sau
去年|qù nián|Năm ngoái
日期|rì qī|Ngày tháng
日历|rì lì|Lịch
生日|shēng rì|Sinh nhật
节日|jié rì|Ngày lễ
假期|jià qī|Kỳ nghỉ
早|zǎo|Sớm
晚|wǎn|Muộn
以前|yǐ qián|Trước đây
以后|yǐ hòu|Sau này
开始|kāi shǐ|Bắt đầu
结束|jié shù|Kết thúc
准时|zhǔn shí|Đúng giờ
迟到|chí dào|Đến muộn`)]
];
