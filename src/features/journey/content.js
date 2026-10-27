// Original GoPinyin dialogues, bundled offline; not official exam papers.
// Speaker labels stay separate from the Chinese used by listening and typing.
function reading(level, id, title, topic, speakers, lines, vocabulary, questions) {
  return {id, level, revision:level === 1 ? 2 : 1, title, topic,
    lines:lines.map((line,index) => [...line,speakers[index % speakers.length]]), vocabulary, questions};
}

export const readings = [
  reading(1,'hello','Chào bạn mới','Chào hỏi',['Tiểu Minh','Lan'],[
    ['你好！我叫小明。你叫什么名字？','Nǐ hǎo! Wǒ jiào Xiǎomíng. Nǐ jiào shénme míngzi?','Xin chào! Tôi tên Tiểu Minh. Bạn tên là gì?'],
    ['你好！我叫小兰。你是学生吗？','Nǐ hǎo! Wǒ jiào Xiǎolán. Nǐ shì xuésheng ma?','Chào bạn! Tôi tên Tiểu Lan. Bạn là học sinh à?'],
    ['是，我是学生。我学习汉语。','Shì, wǒ shì xuésheng. Wǒ xuéxí Hànyǔ.','Đúng vậy, tôi là học sinh. Tôi học tiếng Trung.'],
    ['我也是学生。我也学习汉语。','Wǒ yě shì xuésheng. Wǒ yě xuéxí Hànyǔ.','Tôi cũng là học sinh. Tôi cũng học tiếng Trung.'],
    ['你是哪国人？','Nǐ shì nǎ guó rén?','Bạn là người nước nào?'],
    ['我是越南人。你呢？','Wǒ shì Yuènán rén. Nǐ ne?','Tôi là người Việt Nam. Còn bạn?'],
    ['我是中国人。你今年多大？','Wǒ shì Zhōngguó rén. Nǐ jīnnián duō dà?','Tôi là người Trung Quốc. Năm nay bạn bao nhiêu tuổi?'],
    ['我今年二十岁。你多大？','Wǒ jīnnián èrshí suì. Nǐ duō dà?','Năm nay tôi hai mươi tuổi. Bạn bao nhiêu tuổi?'],
    ['我也二十岁。你住在哪儿？','Wǒ yě èrshí suì. Nǐ zhù zài nǎr?','Tôi cũng hai mươi tuổi. Bạn sống ở đâu?'],
    ['我住在学校。你也住在学校吗？','Wǒ zhù zài xuéxiào. Nǐ yě zhù zài xuéxiào ma?','Tôi sống ở trường. Bạn cũng sống ở trường à?'],
    ['是。很高兴认识你！','Shì. Hěn gāoxìng rènshi nǐ!','Đúng vậy. Rất vui được làm quen với bạn!'],
    ['我也很高兴。明天在学校见！','Wǒ yě hěn gāoxìng. Míngtiān zài xuéxiào jiàn!','Tôi cũng rất vui. Hẹn gặp ở trường ngày mai!']
  ],[['学生','xuésheng','học sinh'],['学习','xuéxí','học'],['名字','míngzi','tên'],['认识','rènshi','quen biết']],[
    ['Tiểu Minh là ai?',['Học sinh','Bác sĩ','Giáo viên'],0],
    ['Hai bạn cùng học gì?',['Tiếng Anh','Tiếng Trung','Toán'],1],
    ['Hai bạn hẹn gặp lại ở đâu?',['Nhà hàng','Bệnh viện','Trường học'],2]
  ]),
  reading(1,'family','Gia đình của tôi','Gia đình',['Lan','Tiểu Minh'],[
    ['小明，你家有几个人？','Xiǎomíng, nǐ jiā yǒu jǐ ge rén?','Tiểu Minh, nhà bạn có mấy người?'],
    ['我家有三个人：爸爸、妈妈和我。','Wǒ jiā yǒu sān ge rén: bàba, māma hé wǒ.','Nhà tôi có ba người: bố, mẹ và tôi.'],
    ['你爸爸做什么工作？','Nǐ bàba zuò shénme gōngzuò?','Bố bạn làm nghề gì?'],
    ['我爸爸是医生，在医院工作。','Wǒ bàba shì yīshēng, zài yīyuàn gōngzuò.','Bố tôi là bác sĩ, làm việc ở bệnh viện.'],
    ['你妈妈也是医生吗？','Nǐ māma yě shì yīshēng ma?','Mẹ bạn cũng là bác sĩ à?'],
    ['不是，她是老师，在学校工作。','Bú shì, tā shì lǎoshī, zài xuéxiào gōngzuò.','Không, mẹ tôi là giáo viên, làm việc ở trường học.'],
    ['你们住在哪儿？','Nǐmen zhù zài nǎr?','Gia đình bạn sống ở đâu?'],
    ['我们住在北京。你家呢？','Wǒmen zhù zài Běijīng. Nǐ jiā ne?','Chúng tôi sống ở Bắc Kinh. Còn gia đình bạn?'],
    ['我爸爸妈妈住在越南。我现在住在学校。','Wǒ bàba māma zhù zài Yuènán. Wǒ xiànzài zhù zài xuéxiào.','Bố mẹ tôi sống ở Việt Nam. Bây giờ tôi sống ở trường.'],
    ['你每天给他们打电话吗？','Nǐ měi tiān gěi tāmen dǎ diànhuà ma?','Bạn có gọi điện cho họ mỗi ngày không?'],
    ['是，我晚上给妈妈打电话。','Shì, wǒ wǎnshang gěi māma dǎ diànhuà.','Có, buổi tối tôi gọi điện cho mẹ.'],
    ['我也每天给爸爸妈妈打电话。我很爱他们。','Wǒ yě měi tiān gěi bàba māma dǎ diànhuà. Wǒ hěn ài tāmen.','Tôi cũng gọi điện cho bố mẹ mỗi ngày. Tôi rất yêu họ.']
  ],[['家','jiā','nhà, gia đình'],['医生','yīshēng','bác sĩ'],['老师','lǎoshī','giáo viên'],['打电话','dǎ diànhuà','gọi điện']],[
    ['Nhà Tiểu Minh có mấy người?',['Hai','Ba','Bốn'],1],
    ['Bố Tiểu Minh làm nghề gì?',['Bác sĩ','Giáo viên','Đầu bếp'],0],
    ['Mẹ Tiểu Minh làm việc ở đâu?',['Cửa hàng','Bệnh viện','Trường học'],2]
  ]),
  reading(1,'breakfast','Một buổi sáng','Ăn uống',['Tiểu Minh','Mẹ'],[
    ['妈妈，现在几点？','Māma, xiànzài jǐ diǎn?','Mẹ ơi, bây giờ là mấy giờ?'],
    ['现在是早上七点。你想吃什么？','Xiànzài shì zǎoshang qī diǎn. Nǐ xiǎng chī shénme?','Bây giờ là bảy giờ sáng. Con muốn ăn gì?'],
    ['我想吃米饭和鸡蛋。','Wǒ xiǎng chī mǐfàn hé jīdàn.','Con muốn ăn cơm và trứng.'],
    ['好。你想喝茶吗？','Hǎo. Nǐ xiǎng hē chá ma?','Được. Con muốn uống trà không?'],
    ['我不喝茶，我想喝水。','Wǒ bù hē chá, wǒ xiǎng hē shuǐ.','Con không uống trà, con muốn uống nước.'],
    ['水在桌子上，鸡蛋也在这儿。','Shuǐ zài zhuōzi shang, jīdàn yě zài zhèr.','Nước ở trên bàn, trứng cũng ở đây.'],
    ['谢谢妈妈。您喝什么？','Xièxie māma. Nín hē shénme?','Con cảm ơn mẹ. Mẹ uống gì ạ?'],
    ['我喝茶，不喝咖啡。','Wǒ hē chá, bù hē kāfēi.','Mẹ uống trà, không uống cà phê.'],
    ['爸爸在家吗？他吃饭了吗？','Bàba zài jiā ma? Tā chī fàn le ma?','Bố có ở nhà không? Bố ăn cơm chưa ạ?'],
    ['他去医院了。他六点吃的饭。','Tā qù yīyuàn le. Tā liù diǎn chī de fàn.','Bố đến bệnh viện rồi. Bố ăn lúc sáu giờ.'],
    ['我八点去学校。妈妈，再见！','Wǒ bā diǎn qù xuéxiào. Māma, zàijiàn!','Tám giờ con đến trường. Con chào mẹ!'],
    ['再见！中午回家吃饭。','Zàijiàn! Zhōngwǔ huí jiā chī fàn.','Chào con! Trưa về nhà ăn cơm nhé.']
  ],[['早上','zǎoshang','buổi sáng'],['米饭','mǐfàn','cơm'],['鸡蛋','jīdàn','trứng'],['喝','hē','uống']],[
    ['Lúc bắt đầu hội thoại là mấy giờ?',['Sáu giờ','Bảy giờ','Tám giờ'],1],
    ['Tiểu Minh muốn uống gì?',['Trà','Cà phê','Nước'],2],
    ['Mẹ không uống gì?',['Cà phê','Nước','Trà'],0]
  ]),
  reading(1,'school','Đến trường','Trường học',['Lan','Tiểu Minh'],[
    ['小明，今天你去学校吗？','Xiǎomíng, jīntiān nǐ qù xuéxiào ma?','Tiểu Minh, hôm nay bạn có đến trường không?'],
    ['去。我们一起去吧。','Qù. Wǒmen yìqǐ qù ba.','Có. Chúng ta cùng đi nhé.'],
    ['好。我们的老师在学校吗？','Hǎo. Wǒmen de lǎoshī zài xuéxiào ma?','Được. Giáo viên của chúng ta có ở trường không?'],
    ['在。老师九点教我们汉语。','Zài. Lǎoshī jiǔ diǎn jiāo wǒmen Hànyǔ.','Có. Chín giờ thầy dạy chúng ta tiếng Trung.'],
    ['现在八点半，我们有时间。','Xiànzài bā diǎn bàn, wǒmen yǒu shíjiān.','Bây giờ là tám giờ rưỡi, chúng ta còn thời gian.'],
    ['我们先看书，好吗？','Wǒmen xiān kàn shū, hǎo ma?','Chúng ta đọc sách trước, được không?'],
    ['好。这本书是你的吗？','Hǎo. Zhè běn shū shì nǐ de ma?','Được. Quyển sách này là của bạn à?'],
    ['是我的。你的书在哪儿？','Shì wǒ de. Nǐ de shū zài nǎr?','Là của tôi. Sách của bạn ở đâu?'],
    ['我的书在桌子上。我还想写汉字。','Wǒ de shū zài zhuōzi shang. Wǒ hái xiǎng xiě Hànzì.','Sách của tôi ở trên bàn. Tôi còn muốn viết chữ Hán.'],
    ['这个字怎么写？你会吗？','Zhè ge zì zěnme xiě? Nǐ huì ma?','Chữ này viết thế nào? Bạn biết không?'],
    ['我不会。我们问老师吧。','Wǒ bú huì. Wǒmen wèn lǎoshī ba.','Tôi không biết. Chúng ta hỏi thầy nhé.'],
    ['好。老师来了，我们开始学习吧。','Hǎo. Lǎoshī lái le, wǒmen kāishǐ xuéxí ba.','Được. Thầy đến rồi, chúng ta bắt đầu học thôi.']
  ],[['学校','xuéxiào','trường học'],['汉字','Hànzì','chữ Hán'],['书','shū','sách'],['问','wèn','hỏi']],[
    ['Hai bạn cùng đi đâu?',['Trường học','Bệnh viện','Cửa hàng'],0],
    ['Giờ học tiếng Trung bắt đầu lúc nào?',['Tám giờ','Chín giờ','Mười giờ'],1],
    ['Lan muốn viết gì?',['Số điện thoại','Địa chỉ','Chữ Hán'],2]
  ]),
  reading(1,'shop','Mua táo','Mua sắm',['Lan','Người bán'],[
    ['您好！这里有苹果吗？','Nín hǎo! Zhèlǐ yǒu píngguǒ ma?','Xin chào! Ở đây có táo không ạ?'],
    ['有，苹果在这儿。您想买几个？','Yǒu, píngguǒ zài zhèr. Nín xiǎng mǎi jǐ ge?','Có, táo ở đây. Bạn muốn mua mấy quả?'],
    ['一个苹果多少钱？','Yí ge píngguǒ duōshao qián?','Một quả táo bao nhiêu tiền ạ?'],
    ['一个三块钱。','Yí ge sān kuài qián.','Một quả ba tệ.'],
    ['这个苹果很大。我要两个。','Zhè ge píngguǒ hěn dà. Wǒ yào liǎng ge.','Quả táo này to quá. Tôi lấy hai quả.'],
    ['好，两个苹果六块钱。您还买什么？','Hǎo, liǎng ge píngguǒ liù kuài qián. Nín hái mǎi shénme?','Được, hai quả táo sáu tệ. Bạn còn mua gì nữa?'],
    ['我还想买水。水在哪儿？','Wǒ hái xiǎng mǎi shuǐ. Shuǐ zài nǎr?','Tôi còn muốn mua nước. Nước ở đâu ạ?'],
    ['水在桌子下面，一块钱。','Shuǐ zài zhuōzi xiàmian, yí kuài qián.','Nước ở dưới bàn, giá một tệ.'],
    ['好，我也买水。现在是七块钱，对吗？','Hǎo, wǒ yě mǎi shuǐ. Xiànzài shì qī kuài qián, duì ma?','Được, tôi mua cả nước. Bây giờ là bảy tệ, đúng không ạ?'],
    ['对，七块钱。','Duì, qī kuài qián.','Đúng, bảy tệ.'],
    ['给您钱。谢谢！','Gěi nín qián. Xièxie!','Tôi gửi tiền ạ. Cảm ơn!'],
    ['不客气，再见！','Bú kèqi, zàijiàn!','Không có gì, tạm biệt!']
  ],[['商店','shāngdiàn','cửa hàng'],['苹果','píngguǒ','táo'],['买','mǎi','mua'],['多少钱','duōshao qián','bao nhiêu tiền']],[
    ['Lan mua loại quả nào?',['Táo','Cam','Chuối'],0],
    ['Một quả táo giá bao nhiêu?',['Hai tệ','Ba tệ','Năm tệ'],1],
    ['Tổng tiền táo và nước là bao nhiêu?',['Ba tệ','Sáu tệ','Bảy tệ'],2]
  ]),
  reading(1,'weekend','Ngày nghỉ cùng bạn','Sinh hoạt',['Lan','Tiểu Minh'],[
    ['今天是星期六，你想做什么？','Jīntiān shì xīngqīliù, nǐ xiǎng zuò shénme?','Hôm nay là thứ Bảy, bạn muốn làm gì?'],
    ['我想看电影。你想去吗？','Wǒ xiǎng kàn diànyǐng. Nǐ xiǎng qù ma?','Tôi muốn xem phim. Bạn muốn đi không?'],
    ['想。我们几点去？','Xiǎng. Wǒmen jǐ diǎn qù?','Có. Chúng ta đi lúc mấy giờ?'],
    ['上午十点去，好吗？','Shàngwǔ shí diǎn qù, hǎo ma?','Mười giờ sáng đi, được không?'],
    ['好。我们怎么去？','Hǎo. Wǒmen zěnme qù?','Được. Chúng ta đi bằng cách nào?'],
    ['我们坐出租车去。','Wǒmen zuò chūzūchē qù.','Chúng ta đi taxi.'],
    ['看电影以后，我们吃什么？','Kàn diànyǐng yǐhòu, wǒmen chī shénme?','Sau khi xem phim, chúng ta ăn gì?'],
    ['我们去饭店吃米饭和菜。','Wǒmen qù fàndiàn chī mǐfàn hé cài.','Chúng ta đến nhà hàng ăn cơm và thức ăn.'],
    ['我想喝茶。你呢？','Wǒ xiǎng hē chá. Nǐ ne?','Tôi muốn uống trà. Còn bạn?'],
    ['我想喝水。下午我们回家吧。','Wǒ xiǎng hē shuǐ. Xiàwǔ wǒmen huí jiā ba.','Tôi muốn uống nước. Buổi chiều chúng ta về nhà nhé.'],
    ['好。我晚上在家学习汉语。','Hǎo. Wǒ wǎnshang zài jiā xuéxí Hànyǔ.','Được. Buổi tối tôi học tiếng Trung ở nhà.'],
    ['我也学习汉语。明天我们再一起看书。','Wǒ yě xuéxí Hànyǔ. Míngtiān wǒmen zài yìqǐ kàn shū.','Tôi cũng học tiếng Trung. Ngày mai chúng ta lại cùng đọc sách.']
  ],[['星期六','xīngqīliù','thứ Bảy'],['电影','diànyǐng','phim'],['出租车','chūzūchē','taxi'],['回家','huí jiā','về nhà']],[
    ['Hôm nay là ngày nào?',['Thứ Hai','Chủ nhật','Thứ Bảy'],2],
    ['Hai bạn sẽ đi làm gì vào buổi sáng?',['Xem phim','Mua sách','Đến trường'],0],
    ['Hai bạn định về nhà khi nào?',['Buổi sáng','Buổi chiều','Buổi tối'],1]
  ]),
  reading(2,'hsk2-appointments','Hẹn gặp vào cuối tuần','Hẹn gặp',['Lan','Tiểu Minh'],[
    ['这个周末你有时间吗？','Zhè ge zhōumò nǐ yǒu shíjiān ma?','Cuối tuần này bạn có thời gian không?'],
    ['星期六我要上班，星期天有时间。','Xīngqīliù wǒ yào shàng bān, xīngqītiān yǒu shíjiān.','Thứ Bảy tôi phải đi làm, Chủ nhật thì rảnh.'],
    ['我们星期天一起去游泳，怎么样？','Wǒmen xīngqītiān yìqǐ qù yóuyǒng, zěnmeyàng?','Chủ nhật chúng ta cùng đi bơi nhé, bạn thấy sao?'],
    ['好啊！你想几点去？','Hǎo a! Nǐ xiǎng jǐ diǎn qù?','Hay đấy! Bạn muốn đi lúc mấy giờ?'],
    ['上午九点，可以吗？','Shàngwǔ jiǔ diǎn, kěyǐ ma?','Chín giờ sáng, được không?'],
    ['九点有点儿早，十点吧。','Jiǔ diǎn yǒudiǎnr zǎo, shí diǎn ba.','Chín giờ hơi sớm, mười giờ nhé.'],
    ['没问题。我们在哪儿见面？','Méi wèntí. Wǒmen zài nǎr jiàn miàn?','Không vấn đề gì. Chúng ta gặp nhau ở đâu?'],
    ['在学校门口见面。','Zài xuéxiào ménkǒu jiàn miàn.','Gặp ở cổng trường.'],
    ['那儿离你家远吗？','Nàr lí nǐ jiā yuǎn ma?','Chỗ đó cách nhà bạn xa không?'],
    ['不远，走路十分钟就到了。','Bù yuǎn, zǒu lù shí fēnzhōng jiù dào le.','Không xa, đi bộ mười phút là đến.'],
    ['游泳以后，我们一起吃午饭吧。','Yóuyǒng yǐhòu, wǒmen yìqǐ chī wǔfàn ba.','Sau khi bơi, chúng ta cùng ăn trưa nhé.'],
    ['好，我知道一家很好吃的饭店。','Hǎo, wǒ zhīdào yì jiā hěn hǎochī de fàndiàn.','Được, tôi biết một nhà hàng đồ ăn rất ngon.'],
    ['那就星期天上午十点见！','Nà jiù xīngqītiān shàngwǔ shí diǎn jiàn!','Vậy hẹn gặp lúc mười giờ sáng Chủ nhật!'],
    ['好，如果下雨，我就给你打电话。','Hǎo, rúguǒ xià yǔ, wǒ jiù gěi nǐ dǎ diànhuà.','Được, nếu trời mưa thì tôi sẽ gọi cho bạn.']
  ],[['周末','zhōumò','cuối tuần'],['游泳','yóuyǒng','bơi'],['见面','jiàn miàn','gặp mặt'],['门口','ménkǒu','cổng, cửa ra vào']],[
    ['Hai bạn hẹn đi bơi vào ngày nào?',['Thứ Sáu','Thứ Bảy','Chủ nhật'],2],
    ['Cuối cùng họ thống nhất gặp lúc mấy giờ?',['Chín giờ','Mười giờ','Mười một giờ'],1],
    ['Địa điểm gặp là ở đâu?',['Cổng trường','Trước nhà hàng','Nhà Tiểu Minh'],0]
  ]),
  reading(2,'hsk2-directions','Đường đến ga tàu','Hỏi đường',['Lan','Người đi đường'],[
    ['您好，请问火车站怎么走？','Nín hǎo, qǐngwèn huǒchēzhàn zěnme zǒu?','Xin chào, cho tôi hỏi đường đến ga tàu hỏa đi thế nào?'],
    ['你先一直往前走。','Nǐ xiān yìzhí wǎng qián zǒu.','Bạn cứ đi thẳng về phía trước.'],
    ['到前面那个路口吗？','Dào qiánmian nà ge lùkǒu ma?','Đến giao lộ phía trước kia phải không ạ?'],
    ['对，到了路口往左走。','Duì, dào le lùkǒu wǎng zuǒ zǒu.','Đúng, đến giao lộ thì rẽ trái.'],
    ['往左走以后，就能看到火车站吗？','Wǎng zuǒ zǒu yǐhòu, jiù néng kàn dào huǒchēzhàn ma?','Sau khi rẽ trái là nhìn thấy ga tàu luôn à?'],
    ['还要走五分钟，火车站在右边。','Hái yào zǒu wǔ fēnzhōng, huǒchēzhàn zài yòubian.','Còn phải đi năm phút nữa, ga tàu ở bên phải.'],
    ['火车站旁边有什么？','Huǒchēzhàn pángbiān yǒu shénme?','Bên cạnh ga tàu có gì ạ?'],
    ['旁边有一家商店，对面有一家饭店。','Pángbiān yǒu yì jiā shāngdiàn, duìmiàn yǒu yì jiā fàndiàn.','Bên cạnh có một cửa hàng, đối diện có một nhà hàng.'],
    ['从这里走过去要多长时间？','Cóng zhèlǐ zǒu guòqu yào duō cháng shíjiān?','Từ đây đi bộ đến đó mất bao lâu?'],
    ['一共大约十五分钟。','Yígòng dàyuē shíwǔ fēnzhōng.','Tổng cộng khoảng mười lăm phút.'],
    ['我有很多东西，可以坐公共汽车吗？','Wǒ yǒu hěn duō dōngxi, kěyǐ zuò gōnggòng qìchē ma?','Tôi mang nhiều đồ, có thể đi xe buýt không?'],
    ['可以，前面有车站，坐三路车就到。','Kěyǐ, qiánmian yǒu chēzhàn, zuò sān lù chē jiù dào.','Được, phía trước có trạm xe, đi tuyến số ba là tới.'],
    ['太好了，谢谢您的帮助！','Tài hǎo le, xièxie nín de bāngzhù!','Tốt quá, cảm ơn sự giúp đỡ của bác!'],
    ['不客气，路上小心！','Bú kèqi, lù shang xiǎoxīn!','Không có gì, đi đường cẩn thận nhé!']
  ],[['火车站','huǒchēzhàn','ga tàu hỏa'],['往','wǎng','về phía'],['右边','yòubian','bên phải'],['公共汽车','gōnggòng qìchē','xe buýt']],[
    ['Đến giao lộ thì phải rẽ hướng nào?',['Rẽ trái','Rẽ phải','Quay lại'],0],
    ['Nếu đi bộ, tổng thời gian khoảng bao lâu?',['Năm phút','Mười lăm phút','Ba mươi phút'],1],
    ['Xe buýt nào đến ga tàu?',['Tuyến số một','Tuyến số hai','Tuyến số ba'],2]
  ]),
  reading(2,'hsk2-restaurant','Bữa trưa ở nhà hàng','Gọi món',['Khách','Nhân viên'],[
    ['你好，我们两个人，有桌子吗？','Nǐ hǎo, wǒmen liǎng ge rén, yǒu zhuōzi ma?','Xin chào, chúng tôi có hai người, còn bàn không?'],
    ['有，请坐这里。这是菜单。','Yǒu, qǐng zuò zhèlǐ. Zhè shì càidān.','Có, mời ngồi ở đây. Đây là thực đơn.'],
    ['你们这里什么菜最好吃？','Nǐmen zhèlǐ shénme cài zuì hǎochī?','Ở đây món nào ngon nhất?'],
    ['我们做的鱼很好吃，您可以试试。','Wǒmen zuò de yú hěn hǎochī, nín kěyǐ shìshi.','Món cá của chúng tôi rất ngon, anh có thể thử.'],
    ['这道鱼辣不辣？我的朋友不吃辣。','Zhè dào yú là bu là? Wǒ de péngyou bù chī là.','Món cá này có cay không? Bạn tôi không ăn cay.'],
    ['可以做不辣的，您放心。','Kěyǐ zuò bú là de, nín fàngxīn.','Có thể làm không cay, anh yên tâm.'],
    ['好，我们要一条鱼和一个青菜。','Hǎo, wǒmen yào yì tiáo yú hé yí ge qīngcài.','Được, chúng tôi lấy một con cá và một món rau xanh.'],
    ['要几碗米饭？','Yào jǐ wǎn mǐfàn?','Anh lấy mấy bát cơm?'],
    ['两碗米饭，再来两杯水。','Liǎng wǎn mǐfàn, zài lái liǎng bēi shuǐ.','Hai bát cơm, thêm hai cốc nước.'],
    ['好的，请等一会儿，菜很快就好。','Hǎo de, qǐng děng yíhuìr, cài hěn kuài jiù hǎo.','Vâng, xin đợi một lát, món ăn sẽ có ngay.'],
    ['我们下午一点有事，来得及吗？','Wǒmen xiàwǔ yì diǎn yǒu shì, láidejí ma?','Một giờ chiều chúng tôi có việc, có kịp không?'],
    ['现在十二点，二十分钟就能做好。',"Xiànzài shí'èr diǎn, èrshí fēnzhōng jiù néng zuò hǎo.",'Bây giờ là mười hai giờ, hai mươi phút là làm xong.'],
    ['那就好。请问一共多少钱？','Nà jiù hǎo. Qǐngwèn yígòng duōshao qián?','Vậy thì tốt. Cho hỏi tổng cộng bao nhiêu tiền?'],
    ['一共六十八块钱，水不要钱。','Yígòng liùshíbā kuài qián, shuǐ bú yào qián.','Tổng cộng sáu mươi tám tệ, nước miễn phí.']
  ],[['菜单','càidān','thực đơn'],['辣','là','cay'],['米饭','mǐfàn','cơm'],['一共','yígòng','tổng cộng']],[
    ['Khách yêu cầu làm món cá thế nào?',['Thật cay','Không cay','Không có rau'],1],
    ['Khách gọi mấy bát cơm?',['Một bát','Ba bát','Hai bát'],2],
    ['Tổng tiền bữa ăn là bao nhiêu?',['Sáu mươi tám tệ','Tám mươi sáu tệ','Sáu mươi tệ'],0]
  ]),
  reading(2,'hsk2-doctor','Đi khám khi bị cảm','Sức khỏe',['Bệnh nhân','Bác sĩ'],[
    ['医生，我今天身体不舒服。','Yīshēng, wǒ jīntiān shēntǐ bù shūfu.','Bác sĩ ơi, hôm nay tôi thấy không khỏe.'],
    ['你哪里不舒服？','Nǐ nǎlǐ bù shūfu?','Bạn thấy khó chịu ở đâu?'],
    ['我头疼，还一直咳嗽。','Wǒ tóu téng, hái yìzhí késou.','Tôi đau đầu, còn ho liên tục.'],
    ['什么时候开始的？','Shénme shíhou kāishǐ de?','Bắt đầu từ lúc nào?'],
    ['昨天晚上开始的，今天更难受。','Zuótiān wǎnshang kāishǐ de, jīntiān gèng nánshòu.','Bắt đầu từ tối qua, hôm nay khó chịu hơn.'],
    ['你发烧了吗？先量一下体温吧。','Nǐ fā shāo le ma? Xiān liáng yíxià tǐwēn ba.','Bạn có sốt không? Trước tiên đo nhiệt độ nhé.'],
    ['好。医生，我是不是感冒了？','Hǎo. Yīshēng, wǒ shì bu shì gǎnmào le?','Vâng. Bác sĩ ơi, có phải tôi bị cảm rồi không?'],
    ['是，有一点儿发烧，需要休息。','Shì, yǒu yìdiǎnr fā shāo, xūyào xiūxi.','Đúng, bạn hơi sốt, cần nghỉ ngơi.'],
    ['我明天还要去上班，可以吗？','Wǒ míngtiān hái yào qù shàng bān, kěyǐ ma?','Ngày mai tôi còn phải đi làm, có được không?'],
    ['最好先在家休息，多喝水。','Zuì hǎo xiān zài jiā xiūxi, duō hē shuǐ.','Tốt nhất nên nghỉ ở nhà trước và uống nhiều nước.'],
    ['这个药一天吃几次？','Zhè ge yào yì tiān chī jǐ cì?','Thuốc này uống mấy lần một ngày?'],
    ['按药盒上的说明吃，不清楚就问我。','Àn yàohé shang de shuōmíng chī, bù qīngchu jiù wèn wǒ.','Uống theo hướng dẫn trên hộp thuốc, nếu chưa rõ thì hỏi tôi.'],
    ['好的。如果明天还发烧，怎么办？','Hǎo de. Rúguǒ míngtiān hái fā shāo, zěnme bàn?','Vâng. Nếu ngày mai vẫn sốt thì phải làm sao?'],
    ['如果没有好转，请再来医院。','Rúguǒ méiyǒu hǎozhuǎn, qǐng zài lái yīyuàn.','Nếu không đỡ, hãy quay lại bệnh viện.']
  ],[['不舒服','bù shūfu','không khỏe'],['头疼','tóu téng','đau đầu'],['感冒','gǎnmào','cảm'],['休息','xiūxi','nghỉ ngơi']],[
    ['Bệnh nhân bắt đầu thấy khó chịu từ khi nào?',['Sáng nay','Tối qua','Tuần trước'],1],
    ['Bác sĩ khuyên bệnh nhân làm gì trước?',['Nghỉ ở nhà, uống nhiều nước','Đi làm ngay','Đi bơi'],0],
    ['Bệnh nhân cần đọc ở đâu để biết cách dùng thuốc?',['Vé xe','Thực đơn','Hướng dẫn trên hộp thuốc'],2]
  ]),
  reading(2,'hsk2-travel','Mua vé về thăm nhà','Đi lại',['Khách','Nhân viên'],[
    ['您好，我想买一张去上海的火车票。','Nín hǎo, wǒ xiǎng mǎi yì zhāng qù Shànghǎi de huǒchēpiào.','Xin chào, tôi muốn mua một vé tàu đến Thượng Hải.'],
    ['您想哪天出发？','Nín xiǎng nǎ tiān chūfā?','Anh muốn khởi hành ngày nào?'],
    ['明天上午有车吗？','Míngtiān shàngwǔ yǒu chē ma?','Sáng mai có tàu không?'],
    ['有，九点和十一点都有车。','Yǒu, jiǔ diǎn hé shíyī diǎn dōu yǒu chē.','Có, chín giờ và mười một giờ đều có tàu.'],
    ['九点的车几点到上海？','Jiǔ diǎn de chē jǐ diǎn dào Shànghǎi?','Tàu chín giờ đến Thượng Hải lúc mấy giờ?'],
    ['下午两点到，一共五个小时。','Xiàwǔ liǎng diǎn dào, yígòng wǔ ge xiǎoshí.','Hai giờ chiều đến, tổng cộng năm tiếng.'],
    ['那我买九点的票。多少钱？','Nà wǒ mǎi jiǔ diǎn de piào. Duōshao qián?','Vậy tôi mua vé chuyến chín giờ. Bao nhiêu tiền?'],
    ['二等座二百块钱。','Èr děng zuò èrbǎi kuài qián.','Ghế hạng hai hai trăm tệ.'],
    ['有靠窗的座位吗？我喜欢看外面。','Yǒu kào chuāng de zuòwèi ma? Wǒ xǐhuan kàn wàimian.','Có ghế cạnh cửa sổ không? Tôi thích nhìn ra ngoài.'],
    ['有，我给您选一个靠窗的座位。','Yǒu, wǒ gěi nín xuǎn yí ge kào chuāng de zuòwèi.','Có, tôi chọn cho anh một ghế cạnh cửa sổ.'],
    ['请问我要提前多久到车站？','Qǐngwèn wǒ yào tíqián duō jiǔ dào chēzhàn?','Cho hỏi tôi cần đến ga trước bao lâu?'],
    ['请提前半个小时到。','Qǐng tíqián bàn ge xiǎoshí dào.','Anh vui lòng đến trước nửa tiếng.'],
    ['好的，我八点半到。谢谢！','Hǎo de, wǒ bā diǎn bàn dào. Xièxie!','Vâng, tôi sẽ đến lúc tám giờ rưỡi. Cảm ơn!'],
    ['不客气，祝您一路平安！',"Bú kèqi, zhù nín yí lù píng'ān!",'Không có gì, chúc anh lên đường bình an!']
  ],[['火车票','huǒchēpiào','vé tàu hỏa'],['出发','chūfā','khởi hành'],['小时','xiǎoshí','tiếng, giờ'],['座位','zuòwèi','chỗ ngồi']],[
    ['Khách mua vé đến đâu?',['Bắc Kinh','Thượng Hải','Hà Nội'],1],
    ['Chuyến tàu được chọn khởi hành lúc nào?',['Chín giờ sáng','Mười một giờ sáng','Hai giờ chiều'],0],
    ['Khách dự định đến ga lúc mấy giờ?',['Bảy giờ rưỡi','Chín giờ rưỡi','Tám giờ rưỡi'],2]
  ]),
  reading(2,'hsk2-clothing','Chọn áo cho mùa đông','Mua quần áo',['Khách','Nhân viên'],[
    ['你好，我想买一件冬天穿的衣服。','Nǐ hǎo, wǒ xiǎng mǎi yí jiàn dōngtiān chuān de yīfu.','Xin chào, tôi muốn mua một chiếc áo mặc mùa đông.'],
    ['您看看这件红色的，怎么样？','Nín kànkan zhè jiàn hóngsè de, zěnmeyàng?','Chị xem chiếc màu đỏ này thế nào?'],
    ['红色很好看，但是我更喜欢蓝色。','Hóngsè hěn hǎokàn, dànshì wǒ gèng xǐhuan lánsè.','Màu đỏ đẹp lắm, nhưng tôi thích màu xanh dương hơn.'],
    ['我们也有蓝色的，给您这件。','Wǒmen yě yǒu lánsè de, gěi nín zhè jiàn.','Chúng tôi cũng có màu xanh dương, chị xem chiếc này.'],
    ['我可以试穿一下吗？','Wǒ kěyǐ shìchuān yíxià ma?','Tôi có thể mặc thử không?'],
    ['当然可以，试衣间在那边。','Dāngrán kěyǐ, shìyījiān zài nàbian.','Tất nhiên, phòng thử đồ ở đằng kia.'],
    ['这件有点儿大，有小一点儿的吗？','Zhè jiàn yǒudiǎnr dà, yǒu xiǎo yìdiǎnr de ma?','Chiếc này hơi rộng, có chiếc nhỏ hơn một chút không?'],
    ['有，请试试这一件。','Yǒu, qǐng shìshi zhè yí jiàn.','Có, chị thử chiếc này nhé.'],
    ['这件正好。穿着也很舒服。','Zhè jiàn zhènghǎo. Chuānzhe yě hěn shūfu.','Chiếc này vừa vặn. Mặc cũng rất thoải mái.'],
    ['是的，这件衣服很暖和。','Shì de, zhè jiàn yīfu hěn nuǎnhuo.','Vâng, chiếc áo này rất ấm.'],
    ['多少钱？我今天带的钱不太多。','Duōshao qián? Wǒ jīntiān dài de qián bú tài duō.','Bao nhiêu tiền? Hôm nay tôi mang không nhiều tiền lắm.'],
    ['原来二百块，今天一百五十块。','Yuánlái èrbǎi kuài, jīntiān yìbǎi wǔshí kuài.','Giá ban đầu hai trăm tệ, hôm nay một trăm năm mươi tệ.'],
    ['好，我买这件蓝色的。','Hǎo, wǒ mǎi zhè jiàn lánsè de.','Được, tôi mua chiếc màu xanh dương này.'],
    ['好的，我给您装好。谢谢！','Hǎo de, wǒ gěi nín zhuāng hǎo. Xièxie!','Vâng, tôi gói lại cho chị. Cảm ơn!']
  ],[['蓝色','lánsè','màu xanh dương'],['试穿','shìchuān','mặc thử'],['舒服','shūfu','thoải mái'],['暖和','nuǎnhuo','ấm áp']],[
    ['Khách thích màu nào hơn?',['Đỏ','Xanh dương','Đen'],1],
    ['Chiếc áo thử đầu tiên thế nào?',['Hơi rộng','Hơi ngắn','Quá chật'],0],
    ['Giá hôm nay là bao nhiêu?',['Hai trăm tệ','Một trăm tệ','Một trăm năm mươi tệ'],2]
  ]),
  reading(3,"hsk3-work","Cùng chuẩn bị buổi họp","Công việc",["Chị Vương","Tiểu Lâm"],[
    ["小林，明天下午的会议准备得怎么样了？","Xiǎolín, míngtiān xiàwǔ de huìyì zhǔnbèi de zěnmeyàng le?","Tiểu Lâm, bạn chuẩn bị cho cuộc họp chiều mai đến đâu rồi?"],
    ["我已经写好了介绍，但是还没有检查数字。","Wǒ yǐjīng xiě hǎo le jièshào, dànshì hái méiyǒu jiǎnchá shùzì.","Tôi đã viết xong phần giới thiệu, nhưng vẫn chưa kiểm tra các con số."],
    ["别着急，我们还有一天时间。","Bié zháojí, wǒmen hái yǒu yì tiān shíjiān.","Đừng vội, chúng ta vẫn còn một ngày."],
    ["你能帮我看看这些地方有没有问题吗？","Nǐ néng bāng wǒ kànkan zhèxiē dìfang yǒu méiyǒu wèntí ma?","Chị có thể giúp tôi xem những chỗ này có vấn đề gì không?"],
    ["可以。你先把电脑打开，我们一起看。","Kěyǐ. Nǐ xiān bǎ diànnǎo dǎkāi, wǒmen yìqǐ kàn.","Được. Bạn mở máy tính trước đi, chúng ta cùng xem."],
    ["这个月来买东西的人比上个月多了。","Zhè ge yuè lái mǎi dōngxi de rén bǐ shàng ge yuè duō le.","Tháng này số người đến mua hàng nhiều hơn tháng trước."],
    ["这里写的是三百人，对吗？","Zhèlǐ xiě de shì sān bǎi rén, duì ma?","Ở đây ghi là ba trăm người, đúng không?"],
    ["对，我刚才又查了一次，没有写错。","Duì, wǒ gāngcái yòu chá le yí cì, méiyǒu xiě cuò.","Đúng, vừa rồi tôi kiểm tra lại một lần nữa, không viết sai."],
    ["那就好。明天由谁来介绍这些情况？","Nà jiù hǎo. Míngtiān yóu shéi lái jièshào zhèxiē qíngkuàng?","Vậy thì tốt. Ngày mai ai sẽ giới thiệu tình hình này?"],
    ["经理让我介绍，我有一点儿担心。","Jīnglǐ ràng wǒ jièshào, wǒ yǒu yìdiǎnr dānxīn.","Giám đốc bảo tôi giới thiệu, tôi hơi lo."],
    ["你准备得很认真，慢慢说就可以了。","Nǐ zhǔnbèi de hěn rènzhēn, mànman shuō jiù kěyǐ le.","Bạn chuẩn bị rất nghiêm túc rồi, cứ nói chậm là được."],
    ["我想今天下班前再练习一次。","Wǒ xiǎng jīntiān xiàbān qián zài liànxí yí cì.","Tôi muốn luyện thêm một lần trước khi tan làm hôm nay."],
    ["好，我四点有空，可以听你练习。","Hǎo, wǒ sì diǎn yǒu kòng, kěyǐ tīng nǐ liànxí.","Được, bốn giờ tôi rảnh, có thể nghe bạn luyện tập."],
    ["谢谢你！会议是在二楼的房间吗？","Xièxie nǐ! Huìyì shì zài èr lóu de fángjiān ma?","Cảm ơn chị! Cuộc họp ở phòng tầng hai phải không?"],
    ["不是，已经改到三楼了，下午两点开始。","Bú shì, yǐjīng gǎi dào sān lóu le, xiàwǔ liǎng diǎn kāishǐ.","Không, đã chuyển lên tầng ba rồi, bắt đầu lúc hai giờ chiều."],
    ["我记下来了，明天会早点儿到。","Wǒ jì xiàlai le, míngtiān huì zǎo diǎnr dào.","Tôi ghi lại rồi, ngày mai sẽ đến sớm một chút."]
  ],[["会议","huìyì","cuộc họp"],["检查","jiǎnchá","kiểm tra"],["经理","jīnglǐ","giám đốc, quản lý"],["认真","rènzhēn","nghiêm túc, cẩn thận"],["担心","dānxīn","lo lắng"]],[
    ["Ai sẽ giới thiệu tình hình tại cuộc họp?",["Chị Vương","Tiểu Lâm","Một khách hàng"],1],
    ["Cuộc họp ngày mai diễn ra ở đâu?",["Tầng một","Tầng hai","Tầng ba"],2],
    ["Hai người sẽ luyện phần giới thiệu lúc mấy giờ hôm nay?",["Bốn giờ","Hai giờ","Sáu giờ"],0]
  ]),
  reading(3,"hsk3-study","Lập kế hoạch ôn thi tiếng Trung","Học tập",["Lan","Minh"],[
    ["下个月就要考试了，你开始复习了吗？","Xià ge yuè jiù yào kǎoshì le, nǐ kāishǐ fùxí le ma?","Tháng sau thi rồi, bạn bắt đầu ôn tập chưa?"],
    ["开始了，可是我觉得听力还是很难。","Kāishǐ le, kěshì wǒ juéde tīnglì háishi hěn nán.","Bắt đầu rồi, nhưng mình thấy phần nghe vẫn rất khó."],
    ["你每天听多长时间的汉语？","Nǐ měi tiān tīng duō cháng shíjiān de Hànyǔ?","Mỗi ngày bạn nghe tiếng Trung bao lâu?"],
    ["大概二十分钟，有时候太忙就不听了。","Dàgài èrshí fēnzhōng, yǒu shíhou tài máng jiù bù tīng le.","Khoảng hai mươi phút, đôi khi bận quá thì mình không nghe."],
    ["我们可以每天一起练习，互相帮助。","Wǒmen kěyǐ měi tiān yìqǐ liànxí, hùxiāng bāngzhù.","Chúng ta có thể luyện cùng nhau hằng ngày và giúp đỡ nhau."],
    ["好啊！你想在哪儿学习？","Hǎo a! Nǐ xiǎng zài nǎr xuéxí?","Hay đấy! Bạn muốn học ở đâu?"],
    ["图书馆比较安静，而且离我们家都不远。","Túshūguǎn bǐjiào ānjìng, érqiě lí wǒmen jiā dōu bù yuǎn.","Thư viện khá yên tĩnh, hơn nữa cách nhà cả hai chúng ta đều không xa."],
    ["那每天晚上七点在图书馆见，可以吗？","Nà měi tiān wǎnshang qī diǎn zài túshūguǎn jiàn, kěyǐ ma?","Vậy mỗi tối bảy giờ gặp ở thư viện, được không?"],
    ["可以。我们先听课文，再回答问题。","Kěyǐ. Wǒmen xiān tīng kèwén, zài huídá wèntí.","Được. Chúng ta nghe bài khóa trước, rồi trả lời câu hỏi."],
    ["如果有不懂的词，我们就一起查词典。","Rúguǒ yǒu bù dǒng de cí, wǒmen jiù yìqǐ chá cídiǎn.","Nếu có từ không hiểu thì chúng ta cùng tra từ điển."],
    ["对，不过第一次听的时候，先别看书。","Duì, búguò dì yī cì tīng de shíhou, xiān bié kàn shū.","Đúng, nhưng lúc nghe lần đầu thì chưa nhìn sách nhé."],
    ["这样能知道自己真正听懂了多少。","Zhèyàng néng zhīdào zìjǐ zhēnzhèng tīng dǒng le duōshao.","Như vậy mới biết bản thân thực sự nghe hiểu được bao nhiêu."],
    ["听完以后，我们还可以练习说汉语。","Tīng wán yǐhòu, wǒmen hái kěyǐ liànxí shuō Hànyǔ.","Nghe xong, chúng ta còn có thể luyện nói tiếng Trung."],
    ["我以前怕说错，现在想多试一试。","Wǒ yǐqián pà shuō cuò, xiànzài xiǎng duō shì yi shì.","Trước đây mình sợ nói sai, giờ mình muốn thử nhiều hơn."],
    ["说错了也没关系，发现问题才会进步。","Shuō cuò le yě méi guānxi, fāxiàn wèntí cái huì jìnbù.","Nói sai cũng không sao, phát hiện vấn đề thì mới tiến bộ được."],
    ["那就这么决定了，我今晚把书带来。","Nà jiù zhème juédìng le, wǒ jīnwǎn bǎ shū dài lái.","Vậy quyết định thế nhé, tối nay mình sẽ mang sách đến."]
  ],[["复习","fùxí","ôn tập"],["听力","tīnglì","kỹ năng nghe"],["安静","ānjìng","yên tĩnh"],["词典","cídiǎn","từ điển"],["进步","jìnbù","tiến bộ"]],[
    ["Minh thấy phần nào còn khó?",["Nghe","Viết tên","Đọc số"],0],
    ["Hai người hẹn học ở thư viện khi nào?",["Sáu giờ sáng","Tám giờ tối","Bảy giờ tối"],2],
    ["Khi nghe lần đầu, họ thống nhất làm gì?",["Đọc ngay bản dịch","Chưa nhìn sách","Chỉ tra từ điển"],1]
  ]),
  reading(3,"hsk3-moving","Tìm căn nhà gần công ty","Nhà ở và chuyển nhà",["Nam","Hà"],[
    ["听说你最近想搬家，找到合适的房子了吗？","Tīngshuō nǐ zuìjìn xiǎng bān jiā, zhǎo dào héshì de fángzi le ma?","Nghe nói gần đây bạn muốn chuyển nhà, đã tìm được căn phù hợp chưa?"],
    ["找到了，星期六下午我准备去看看。","Zhǎo dào le, xīngqīliù xiàwǔ wǒ zhǔnbèi qù kànkan.","Tìm được rồi, chiều thứ Bảy mình định đi xem."],
    ["你现在住的地方有什么问题？","Nǐ xiànzài zhù de dìfang yǒu shénme wèntí?","Chỗ bạn đang ở có vấn đề gì vậy?"],
    ["离公司太远，每天坐车要一个半小时。","Lí gōngsī tài yuǎn, měi tiān zuò chē yào yí ge bàn xiǎoshí.","Xa công ty quá, mỗi ngày ngồi xe mất một tiếng rưỡi."],
    ["新房子离公司近吗？","Xīn fángzi lí gōngsī jìn ma?","Căn nhà mới có gần công ty không?"],
    ["很近，走路大概十五分钟就到了。","Hěn jìn, zǒu lù dàgài shíwǔ fēnzhōng jiù dào le.","Gần lắm, đi bộ khoảng mười lăm phút là đến."],
    ["那太方便了，房子有多大？","Nà tài fāngbiàn le, fángzi yǒu duō dà?","Vậy tiện quá, căn nhà rộng bao nhiêu?"],
    ["有两个房间，一个厨房，还有一个小客厅。","Yǒu liǎng ge fángjiān, yí ge chúfáng, hái yǒu yí ge xiǎo kètīng.","Có hai phòng, một bếp và một phòng khách nhỏ."],
    ["窗户大不大？房间里亮吗？","Chuānghu dà bu dà? Fángjiān lǐ liàng ma?","Cửa sổ có lớn không? Trong phòng có sáng không?"],
    ["照片上看起来很亮，不过我还得亲自去看。","Zhàopiàn shang kàn qǐlai hěn liàng, búguò wǒ hái děi qīnzì qù kàn.","Nhìn ảnh thì khá sáng, nhưng mình vẫn phải đến xem trực tiếp."],
    ["每个月多少钱？会不会比现在贵很多？","Měi ge yuè duōshao qián? Huì bu huì bǐ xiànzài guì hěn duō?","Mỗi tháng bao nhiêu tiền? Có đắt hơn hiện tại nhiều không?"],
    ["两千块，只比现在多两百块。","Liǎng qiān kuài, zhǐ bǐ xiànzài duō liǎng bǎi kuài.","Hai nghìn tệ, chỉ hơn hiện tại hai trăm tệ."],
    ["如果你决定搬，我可以帮你搬东西。","Rúguǒ nǐ juédìng bān, wǒ kěyǐ bāng nǐ bān dōngxi.","Nếu bạn quyết định chuyển, mình có thể giúp bạn chuyển đồ."],
    ["太好了！我有很多书，一个人搬不动。","Tài hǎo le! Wǒ yǒu hěn duō shū, yí ge rén bān bu dòng.","Tốt quá! Mình có nhiều sách, một người chuyển không nổi."],
    ["你先把书放进箱子里，到时候给我打电话。","Nǐ xiān bǎ shū fàng jìn xiāngzi lǐ, dào shíhou gěi wǒ dǎ diànhuà.","Bạn cho sách vào thùng trước đi, đến lúc đó gọi điện cho mình."],
    ["好，谢谢你。看完房子我再告诉你结果。","Hǎo, xièxie nǐ. Kàn wán fángzi wǒ zài gàosu nǐ jiéguǒ.","Được, cảm ơn bạn. Xem nhà xong mình sẽ báo kết quả cho bạn."]
  ],[["搬家","bān jiā","chuyển nhà"],["合适","héshì","phù hợp"],["方便","fāngbiàn","thuận tiện"],["厨房","chúfáng","nhà bếp"],["箱子","xiāngzi","thùng, hộp"]],[
    ["Vì sao Hà muốn chuyển nhà?",["Nhà không có bếp","Nhà ở xa công ty","Nhà có quá ít sách"],1],
    ["Từ nhà mới đi bộ đến công ty mất khoảng bao lâu?",["Một tiếng rưỡi","Ba mươi phút","Mười lăm phút"],2],
    ["Tiền nhà mới mỗi tháng là bao nhiêu?",["Hai nghìn tệ","Hai trăm tệ","Một nghìn tám trăm tệ"],0]
  ]),
  reading(3,"hsk3-health","Nói chuyện với bác sĩ","Sức khỏe",["Người bệnh","Bác sĩ"],[
    ["医生，您好，我这两天一直觉得很累。","Yīshēng, nín hǎo, wǒ zhè liǎng tiān yìzhí juéde hěn lèi.","Chào bác sĩ, hai ngày nay tôi cứ thấy rất mệt."],
    ["除了累，还有哪里不舒服？","Chúle lèi, hái yǒu nǎlǐ bù shūfu?","Ngoài mệt ra, còn chỗ nào khó chịu không?"],
    ["有时候头疼，晚上也睡不好。","Yǒu shíhou tóu téng, wǎnshang yě shuì bu hǎo.","Đôi khi tôi đau đầu, buổi tối cũng ngủ không ngon."],
    ["你最近工作很忙吗？每天几点睡觉？","Nǐ zuìjìn gōngzuò hěn máng ma? Měi tiān jǐ diǎn shuì jiào?","Gần đây công việc của bạn bận lắm à? Mỗi ngày bạn ngủ lúc mấy giờ?"],
    ["最近事情比较多，我常常十二点以后才睡。","Zuìjìn shìqing bǐjiào duō, wǒ chángcháng shí'èr diǎn yǐhòu cái shuì.","Gần đây khá nhiều việc, tôi thường sau mười hai giờ mới ngủ."],
    ["早上呢？一般几点起床？","Zǎoshang ne? Yìbān jǐ diǎn qǐ chuáng?","Còn buổi sáng thì sao? Thường mấy giờ bạn dậy?"],
    ["六点半，所以每天只睡六个小时左右。","Liù diǎn bàn, suǒyǐ měi tiān zhǐ shuì liù ge xiǎoshí zuǒyòu.","Sáu giờ rưỡi, nên mỗi ngày tôi chỉ ngủ khoảng sáu tiếng."],
    ["我先给你做个检查，再了解一下其他情况。","Wǒ xiān gěi nǐ zuò ge jiǎnchá, zài liǎojiě yíxià qítā qíngkuàng.","Tôi khám cho bạn trước, rồi tìm hiểu thêm các tình trạng khác."],
    ["好的，我需要把外套脱下来吗？","Hǎo de, wǒ xūyào bǎ wàitào tuō xiàlai ma?","Vâng, tôi có cần cởi áo khoác ra không?"],
    ["先不用。你今天吃早饭了吗？","Xiān bú yòng. Nǐ jīntiān chī zǎofàn le ma?","Trước mắt chưa cần. Hôm nay bạn ăn sáng chưa?"],
    ["吃了一点儿面包，还喝了一杯咖啡。","Chī le yìdiǎnr miànbāo, hái hē le yì bēi kāfēi.","Tôi ăn một ít bánh mì và uống một cốc cà phê."],
    ["你平时有时间运动吗？","Nǐ píngshí yǒu shíjiān yùndòng ma?","Bình thường bạn có thời gian vận động không?"],
    ["以前周末会游泳，这个月一次也没去。","Yǐqián zhōumò huì yóu yǒng, zhè ge yuè yí cì yě méi qù.","Trước đây cuối tuần tôi đi bơi, tháng này chưa đi lần nào."],
    ["我们先看检查结果，你也要安排好休息时间。","Wǒmen xiān kàn jiǎnchá jiéguǒ, nǐ yě yào ānpái hǎo xiūxi shíjiān.","Chúng ta xem kết quả khám trước; bạn cũng cần sắp xếp thời gian nghỉ ngơi hợp lý."],
    ["我明白了，检查结果什么时候能出来？","Wǒ míngbai le, jiǎnchá jiéguǒ shénme shíhou néng chūlai?","Tôi hiểu rồi, bao giờ có kết quả khám ạ?"],
    ["今天下午可以来看结果，我们到时候再谈。","Jīntiān xiàwǔ kěyǐ lái kàn jiéguǒ, wǒmen dào shíhou zài tán.","Chiều nay bạn có thể đến xem kết quả, lúc đó chúng ta trao đổi tiếp."]
  ],[["除了","chúle","ngoài, ngoại trừ"],["舒服","shūfu","dễ chịu"],["检查","jiǎnchá","khám, kiểm tra"],["左右","zuǒyòu","khoảng, xấp xỉ"],["结果","jiéguǒ","kết quả"]],[
    ["Người bệnh thường đi ngủ khi nào gần đây?",["Trước chín giờ","Lúc mười giờ","Sau mười hai giờ"],2],
    ["Trước đây người bệnh thường làm gì vào cuối tuần?",["Đi bơi","Chơi bóng đá","Leo núi"],0],
    ["Khi nào người bệnh có thể đến xem kết quả?",["Sáng mai","Chiều nay","Tuần sau"],1]
  ]),
  reading(3,"hsk3-travel","Lên kế hoạch đi Nam Kinh","Lập kế hoạch du lịch",["Huy","Mai"],[
    ["下个周末有三天假，我们去南京玩儿吧。","Xià ge zhōumò yǒu sān tiān jià, wǒmen qù Nánjīng wánr ba.","Cuối tuần sau được nghỉ ba ngày, chúng ta đi Nam Kinh chơi nhé."],
    ["好啊！我还没去过南京，听说那里很漂亮。","Hǎo a! Wǒ hái méi qù guo Nánjīng, tīngshuō nàlǐ hěn piàoliang.","Hay đấy! Mình chưa từng đến Nam Kinh, nghe nói ở đó rất đẹp."],
    ["坐火车大概两个小时，比坐汽车快。","Zuò huǒchē dàgài liǎng ge xiǎoshí, bǐ zuò qìchē kuài.","Đi tàu hỏa khoảng hai tiếng, nhanh hơn đi ô tô."],
    ["我们星期五晚上出发，还是星期六早上走？","Wǒmen xīngqīwǔ wǎnshang chūfā, háishi xīngqīliù zǎoshang zǒu?","Chúng ta xuất phát tối thứ Sáu hay sáng thứ Bảy?"],
    ["我星期五要工作，星期六早上走更合适。","Wǒ xīngqīwǔ yào gōngzuò, xīngqīliù zǎoshang zǒu gèng héshì.","Thứ Sáu mình phải làm việc, đi sáng thứ Bảy thì phù hợp hơn."],
    ["那我们今天就买票吧，别等到最后一天。","Nà wǒmen jīntiān jiù mǎi piào ba, bié děng dào zuìhòu yì tiān.","Vậy hôm nay mua vé luôn nhé, đừng chờ đến ngày cuối."],
    ["可以。我看到了早上八点的车票。","Kěyǐ. Wǒ kàn dào le zǎoshang bā diǎn de chēpiào.","Được. Mình thấy có vé chuyến tám giờ sáng."],
    ["十点左右到，还有很多时间可以参观。","Shí diǎn zuǒyòu dào, hái yǒu hěn duō shíjiān kěyǐ cānguān.","Khoảng mười giờ đến, vẫn còn nhiều thời gian tham quan."],
    ["你想住在车站附近，还是市中心？","Nǐ xiǎng zhù zài chēzhàn fùjìn, háishi shì zhōngxīn?","Bạn muốn ở gần ga hay trung tâm thành phố?"],
    ["市中心吧，吃饭和坐地铁都方便。","Shì zhōngxīn ba, chī fàn hé zuò dìtiě dōu fāngbiàn.","Trung tâm thành phố nhé, ăn uống và đi tàu điện ngầm đều tiện."],
    ["我来找宾馆，你帮忙看看天气怎么样。","Wǒ lái zhǎo bīnguǎn, nǐ bāngmáng kànkan tiānqì zěnmeyàng.","Để mình tìm khách sạn, bạn giúp xem thời tiết thế nào nhé."],
    ["星期六可能下雨，星期天会晴。","Xīngqīliù kěnéng xià yǔ, xīngqītiān huì qíng.","Thứ Bảy có thể mưa, Chủ nhật sẽ nắng."],
    ["如果下雨，我们就先去博物馆。","Rúguǒ xià yǔ, wǒmen jiù xiān qù bówùguǎn.","Nếu trời mưa thì chúng ta đến bảo tàng trước."],
    ["好，天气好的时候再去公园散步。","Hǎo, tiānqì hǎo de shíhou zài qù gōngyuán sàn bù.","Được, khi thời tiết đẹp thì đi dạo công viên sau."],
    ["我想星期一下午回来，这样不用太着急。","Wǒ xiǎng xīngqīyī xiàwǔ huílai, zhèyàng bú yòng tài zháojí.","Mình muốn về chiều thứ Hai, như vậy không phải vội quá."],
    ["没问题，我会带上雨伞和舒服的鞋。","Méi wèntí, wǒ huì dài shang yǔsǎn hé shūfu de xié.","Không vấn đề gì, mình sẽ mang ô và giày đi thoải mái."]
  ],[["出发","chūfā","xuất phát"],["合适","héshì","phù hợp"],["附近","fùjìn","gần, khu vực lân cận"],["如果","rúguǒ","nếu"],["散步","sàn bù","đi dạo"]],[
    ["Hai người quyết định xuất phát khi nào?",["Tối thứ Sáu","Sáng thứ Bảy","Chiều Chủ nhật"],1],
    ["Nếu thứ Bảy trời mưa, họ sẽ đi đâu trước?",["Công viên","Cửa hàng giày","Bảo tàng"],2],
    ["Họ muốn ở khu vực nào?",["Trung tâm thành phố","Gần sân bay","Ngoại ô"],0]
  ]),
  reading(3,"hsk3-shopping","Đổi chiếc áo mua hôm qua","Xử lý vấn đề mua sắm",["Khách hàng","Nhân viên"],[
    ["您好，我昨天买的这件衬衫有点儿小。","Nín hǎo, wǒ zuótiān mǎi de zhè jiàn chènshān yǒu diǎnr xiǎo.","Xin chào, chiếc áo sơ mi tôi mua hôm qua hơi nhỏ."],
    ["您想换一件大一点儿的吗？","Nín xiǎng huàn yí jiàn dà yìdiǎnr de ma?","Anh muốn đổi sang chiếc lớn hơn một chút phải không?"],
    ["对，我喜欢这个颜色，只想换大小。","Duì, wǒ xǐhuan zhè ge yánsè, zhǐ xiǎng huàn dàxiǎo.","Đúng, tôi thích màu này, chỉ muốn đổi kích cỡ."],
    ["请等一下，我帮您找找。","Qǐng děng yíxià, wǒ bāng nín zhǎozhao.","Xin chờ một chút, tôi tìm giúp anh."],
    ["这是我昨天买东西时拿到的票。","Zhè shì wǒ zuótiān mǎi dōngxi shí ná dào de piào.","Đây là phiếu tôi nhận được khi mua hàng hôm qua."],
    ["谢谢。这件蓝色的大号衬衫已经卖完了。","Xièxie. Zhè jiàn lánsè de dà hào chènshān yǐjīng mài wán le.","Cảm ơn anh. Áo sơ mi màu xanh cỡ lớn này đã bán hết rồi."],
    ["其他颜色还有大号的吗？","Qítā yánsè hái yǒu dà hào de ma?","Các màu khác còn cỡ lớn không?"],
    ["白色的还有，价格和蓝色的一样。","Báisè de hái yǒu, jiàgé hé lánsè de yíyàng.","Màu trắng vẫn còn, giá bằng màu xanh."],
    ["那我先试一下白色的，可以吗？","Nà wǒ xiān shì yíxià báisè de, kěyǐ ma?","Vậy tôi thử chiếc màu trắng trước được không?"],
    ["当然可以，试衣服的地方在右边。","Dāngrán kěyǐ, shì yīfu de dìfang zài yòubian.","Tất nhiên là được, chỗ thử đồ ở bên phải."],
    ["这件穿着很舒服，也比那件合适。","Zhè jiàn chuān zhe hěn shūfu, yě bǐ nà jiàn héshì.","Chiếc này mặc rất thoải mái, cũng vừa hơn chiếc kia."],
    ["白色也很好看，您决定换这件吗？","Báisè yě hěn hǎokàn, nín juédìng huàn zhè jiàn ma?","Màu trắng cũng đẹp, anh quyết định đổi sang chiếc này chứ?"],
    ["是的。请问还需要再付钱吗？","Shì de. Qǐngwèn hái xūyào zài fù qián ma?","Đúng vậy. Xin hỏi tôi có cần trả thêm tiền không?"],
    ["不用，因为两件衬衫的价格相同。","Bú yòng, yīnwèi liǎng jiàn chènshān de jiàgé xiāngtóng.","Không cần, vì hai chiếc áo sơ mi có cùng giá."],
    ["好的，谢谢您帮我解决了这个问题。","Hǎo de, xièxie nín bāng wǒ jiějué le zhè ge wèntí.","Vâng, cảm ơn chị đã giúp tôi giải quyết vấn đề này."],
    ["不客气，我把新的衬衫放进袋子里。","Bú kèqi, wǒ bǎ xīn de chènshān fàng jìn dàizi lǐ.","Không có gì, tôi cho chiếc áo sơ mi mới vào túi nhé."]
  ],[["衬衫","chènshān","áo sơ mi"],["换","huàn","đổi"],["价格","jiàgé","giá cả"],["合适","héshì","vừa, phù hợp"],["解决","jiějué","giải quyết"]],[
    ["Vì sao khách hàng muốn đổi áo?",["Áo hơi nhỏ","Áo bị bẩn","Không thích màu xanh"],0],
    ["Cuối cùng khách chọn áo màu gì?",["Xanh","Trắng","Đỏ"],1],
    ["Khách có cần trả thêm tiền không?",["Có, vì áo lớn hơn","Có, vì đổi màu","Không, vì hai chiếc cùng giá"],2]
  ])
];
